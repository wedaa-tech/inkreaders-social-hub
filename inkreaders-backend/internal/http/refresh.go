// internal/http/refresh.go
package http

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
	"strconv"

	"golang.org/x/oauth2"

	"bytes"

	"github.com/google/uuid"
)

// StartTokenRefresher starts a background goroutine that periodically refreshes expiring tokens.
func (a *Auth) StartTokenRefresher(ctx context.Context) {
	iv := os.Getenv("TOKEN_REFRESH_INTERVAL")
	interval := 5 * time.Minute
	if iv != "" {
		if d, err := time.ParseDuration(iv); err == nil {
			interval = d
		}
	}

	wv := os.Getenv("TOKEN_REFRESH_WINDOW")
	window := 10 * time.Minute
	if wv != "" {
		if d, err := time.ParseDuration(wv); err == nil {
			window = d
		}
	}

	log.Printf("[refresher] starting token refresher: interval=%v window=%v", interval, window)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// run once at startup
		a.refreshOnce(context.Background(), window)

		for {
			select {
			case <-ctx.Done():
				log.Println("[refresher] context canceled, stopping token refresher")
				return
			case <-ticker.C:
				a.refreshOnce(ctx, window)
			}
		}
	}()
}

// refreshOnce queries accounts expiring within `window` and attempts to refresh them.
func (a *Auth) refreshOnce(ctx context.Context, window time.Duration) {
	runCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	cutoff := time.Now().Add(window)

	rows, err := a.Store.Pool.Query(runCtx, `
		SELECT id, provider, provider_account_id, access_token, refresh_token, provider_data, expires_at
		FROM accounts
		WHERE expires_at IS NOT NULL AND expires_at <= $1
		ORDER BY expires_at ASC
		LIMIT 100
	`, cutoff)
	if err != nil {
		log.Printf("[refresher] db query error: %v", err)
		return
	}
	defer rows.Close()

	type acctRow struct {
		ID                 uuid.UUID
		Provider           string
		ProviderAccountID  string
		AccessTokenBase64  string
		RefreshTokenBase64 string
		ProviderData       []byte
		ExpiresAt          time.Time
	}

	toRefresh := make([]acctRow, 0)
	for rows.Next() {
		var r acctRow
		if err := rows.Scan(&r.ID, &r.Provider, &r.ProviderAccountID, &r.AccessTokenBase64, &r.RefreshTokenBase64, &r.ProviderData, &r.ExpiresAt); err != nil {
			log.Printf("[refresher] row scan err: %v", err)
			continue
		}
		toRefresh = append(toRefresh, r)
	}

	if len(toRefresh) == 0 {
		return
	}

	log.Printf("[refresher] found %d accounts to consider refreshing", len(toRefresh))
	for _, ar := range toRefresh {
		actx, cancel := context.WithTimeout(runCtx, 20*time.Second)
		err := a.refreshAccount(actx, ar)
		cancel()
		if err != nil {
			log.Printf("[refresher] refresh failed provider=%s account=%s err=%v", ar.Provider, ar.ProviderAccountID, err)
			// mark failure (increment count, set needs_reauth if threshold reached)
			if merr := a.incrementFailure(context.Background(), ar.ID, err); merr != nil {
				log.Printf("[refresher] failed to record refresh failure: %v", merr)
			}
		} else {
			// success: reset failure counters / flags
			if merr := a.resetFailure(context.Background(), ar.ID); merr != nil {
				log.Printf("[refresher] failed to reset failure counters: %v", merr)
			}
			log.Printf("[refresher] refreshed provider=%s account=%s", ar.Provider, ar.ProviderAccountID)
		}
	}
}

// incrementFailure increments the refresh failure counter stored inside provider_data JSONB and
// sets needs_reauth=true when threshold is reached. Does not delete the account.
func (a *Auth) incrementFailure(ctx context.Context, accountID uuid.UUID, lastErr error) error {
	// read current provider_data
	var pdBytes []byte
	if err := a.Store.Pool.QueryRow(ctx, `SELECT provider_data FROM accounts WHERE id=$1`, accountID).Scan(&pdBytes); err != nil {
		return err
	}
	pd := map[string]any{}
	_ = json.Unmarshal(pdBytes, &pd)

	// read current count
	cnt := 0
	if v, ok := pd["refresh_fail_count"]; ok {
		switch t := v.(type) {
		case float64:
			cnt = int(t)
		case int:
			cnt = t
		}
	}
	cnt++
	pd["refresh_fail_count"] = cnt
	pd["last_failure_at"] = time.Now().Format(time.RFC3339)
	pd["last_failure_error"] = fmt.Sprintf("%v", lastErr)

	// threshold from env (default 3)
	th := 3
	if s := os.Getenv("REFRESH_FAIL_THRESHOLD"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			th = v
		}
	}
	if cnt >= th {
		pd["needs_reauth"] = true
	}

	newPD, _ := json.Marshal(pd)
	_, err := a.Store.Pool.Exec(ctx, `UPDATE accounts SET provider_data=$1, updated_at=now() WHERE id=$2`, newPD, accountID)
	return err
}

// resetFailure clears failure counters and removes needs_reauth flag from provider_data.
func (a *Auth) resetFailure(ctx context.Context, accountID uuid.UUID) error {
	var pdBytes []byte
	if err := a.Store.Pool.QueryRow(ctx, `SELECT provider_data FROM accounts WHERE id=$1`, accountID).Scan(&pdBytes); err != nil {
		return err
	}
	pd := map[string]any{}
	_ = json.Unmarshal(pdBytes, &pd)

	// clear fields
	pd["refresh_fail_count"] = 0
	delete(pd, "needs_reauth")
	delete(pd, "last_failure_at")
	delete(pd, "last_failure_error")
	pd["last_refreshed_at"] = time.Now().Format(time.RFC3339)

	newPD, _ := json.Marshal(pd)
	_, err := a.Store.Pool.Exec(ctx, `UPDATE accounts SET provider_data=$1, updated_at=now() WHERE id=$2`, newPD, accountID)
	return err
}

// Below is refreshAccount unchanged except we keep success update paths to include clearing the failure counter.
// (We reuse your existing logic but ensure provider_data includes last_refreshed_at and reset failures on success.)

func (a *Auth) refreshAccount(ctx context.Context, ar struct {
	ID                 uuid.UUID
	Provider           string
	ProviderAccountID  string
	AccessTokenBase64  string
	RefreshTokenBase64 string
	ProviderData       []byte
	ExpiresAt          time.Time
}) error {
	provider := strings.ToLower(ar.Provider)

	// helper: decode+open refresh token (may be empty)
	var plainRefresh string
	if ar.RefreshTokenBase64 != "" {
		raw, derr := base64.StdEncoding.DecodeString(ar.RefreshTokenBase64)
		if derr != nil {
			return fmt.Errorf("base64 decode refresh: %w", derr)
		}
		plainBytes, oerr := a.Box.Open(raw)
		if oerr != nil {
			return fmt.Errorf("decrypt refresh: %w", oerr)
		}
		plainRefresh = string(plainBytes)
	}

	switch provider {
	case "google":
		if plainRefresh == "" {
			return fmt.Errorf("no refresh token for google account")
		}
		cfg, err := oauthConfigFor("google")
		if err != nil {
			return err
		}
		token := &oauth2.Token{
			RefreshToken: plainRefresh,
			Expiry:       time.Now().Add(-1 * time.Hour),
		}
		ts := cfg.TokenSource(ctx, token)
		newTok, err := ts.Token()
		if err != nil {
			return fmt.Errorf("oauth2 refresh error: %w", err)
		}

		newAccess := newTok.AccessToken
		newRefresh := newTok.RefreshToken
		newExpiry := newTok.Expiry

		var encAccessB64, encRefreshB64 string
		if newAccess != "" {
			enc, _ := a.Box.Seal([]byte(newAccess))
			encAccessB64 = base64.StdEncoding.EncodeToString(enc)
		}
		if newRefresh != "" {
			enc, _ := a.Box.Seal([]byte(newRefresh))
			encRefreshB64 = base64.StdEncoding.EncodeToString(enc)
		} else {
			encRefreshB64 = ar.RefreshTokenBase64
		}

		pd := map[string]any{}
		_ = json.Unmarshal(ar.ProviderData, &pd)
		pd["oauth_scope"] = pd["oauth_scope"]
		pd["last_refreshed_at"] = time.Now().Format(time.RFC3339)
		// reset failures on success
		pd["refresh_fail_count"] = 0
		delete(pd, "needs_reauth")
		delete(pd, "last_failure_at")
		delete(pd, "last_failure_error")

		pdBytes, _ := json.Marshal(pd)

		_, err = a.Store.Pool.Exec(ctx, `
			UPDATE accounts
			SET access_token=$1, refresh_token=$2, expires_at=$3, provider_data=$4, updated_at=now()
			WHERE id=$5
		`, encAccessB64, encRefreshB64, newExpiry, pdBytes, ar.ID)
		if err != nil {
			return fmt.Errorf("db update: %w", err)
		}
		return nil

	case "github":
		// GitHub: refresh only if refresh token exists
		if plainRefresh == "" {
			return fmt.Errorf("no refresh token for github (skipping)")
		}
		cfg, err := oauthConfigFor("github")
		if err != nil {
			return err
		}
		token := &oauth2.Token{
			RefreshToken: plainRefresh,
			Expiry:       time.Now().Add(-1 * time.Hour),
		}
		ts := cfg.TokenSource(ctx, token)
		newTok, err := ts.Token()
		if err != nil {
			return fmt.Errorf("github oauth2 refresh error: %w", err)
		}
		newAccess := newTok.AccessToken
		newRefresh := newTok.RefreshToken
		newExpiry := newTok.Expiry

		var encAccessB64, encRefreshB64 string
		if newAccess != "" {
			enc, _ := a.Box.Seal([]byte(newAccess))
			encAccessB64 = base64.StdEncoding.EncodeToString(enc)
		}
		if newRefresh != "" {
			enc, _ := a.Box.Seal([]byte(newRefresh))
			encRefreshB64 = base64.StdEncoding.EncodeToString(enc)
		} else {
			encRefreshB64 = ar.RefreshTokenBase64
		}

		pd := map[string]any{}
		_ = json.Unmarshal(ar.ProviderData, &pd)
		pd["last_refreshed_at"] = time.Now().Format(time.RFC3339)
		pd["refresh_fail_count"] = 0
		delete(pd, "needs_reauth")
		delete(pd, "last_failure_at")
		delete(pd, "last_failure_error")

		pdBytes, _ := json.Marshal(pd)

		_, err = a.Store.Pool.Exec(ctx, `
			UPDATE accounts
			SET access_token=$1, refresh_token=$2, expires_at=$3, provider_data=$4, updated_at=now()
			WHERE id=$4
		`, encAccessB64, encRefreshB64, newExpiry, pdBytes, ar.ID)
		if err != nil {
			return fmt.Errorf("db update: %w", err)
		}
		return nil

	case "bluesky":
		pd := map[string]any{}
		_ = json.Unmarshal(ar.ProviderData, &pd)
		pdsBase := ""
		if v, ok := pd["pds_base"].(string); ok && v != "" {
			pdsBase = v
		} else {
			pdsBase = a.PDSBase
		}
		if plainRefresh == "" {
			return fmt.Errorf("no bluesky refresh token available")
		}

		body := map[string]string{"refreshJwt": plainRefresh}
		b, _ := json.Marshal(body)
		req, _ := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(pdsBase, "/")+"/xrpc/com.atproto.server.refreshSession", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return fmt.Errorf("bluesky refresh http error: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			buf, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("bluesky refresh failed: status=%d body=%s", resp.StatusCode, string(buf))
		}
		var rr struct {
			AccessJwt   string `json:"accessJwt"`
			RefreshJwt  string `json:"refreshJwt"`
			ActiveUntil string `json:"activeUntil"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&rr); err != nil {
			return fmt.Errorf("bluesky decode response: %w", err)
		}

		newAccess := rr.AccessJwt
		newRefresh := rr.RefreshJwt
		newExpiry := parseActiveUntil(rr.ActiveUntil)

		encA, _ := a.Box.Seal([]byte(newAccess))
		encR, _ := a.Box.Seal([]byte(newRefresh))
		encAccessB64 := base64.StdEncoding.EncodeToString(encA)
		encRefreshB64 := base64.StdEncoding.EncodeToString(encR)

		pd["last_refreshed_at"] = time.Now().Format(time.RFC3339)
		pd["refresh_fail_count"] = 0
		delete(pd, "needs_reauth")
		delete(pd, "last_failure_at")
		delete(pd, "last_failure_error")

		pdBytes, _ := json.Marshal(pd)

		_, err = a.Store.Pool.Exec(ctx, `
			UPDATE accounts
			SET access_token=$1, refresh_token=$2, expires_at=$3, provider_data=$4, updated_at=now()
			WHERE id=$5
		`, encAccessB64, encRefreshB64, newExpiry, pdBytes, ar.ID)
		if err != nil {
			return fmt.Errorf("db update: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unsupported provider for refresh: %s", ar.Provider)
	}
}

// internal/http/auth.go
package http

import (
	"bytes"
	crand "crypto/rand"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
	"log"

	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"

	"github.com/google/uuid"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/crypto"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

// SessionData carries session/account info into handlers
type SessionData struct {
	UserID     uuid.UUID
	AccountID  uuid.UUID
	DID        string
	Handle     string
	PDSBase    string
	AccessJWT  string
	RefreshJWT string
	ExpiresAt  time.Time
}

// Auth holds dependencies for auth handlers
type Auth struct {
	Store   *db.Store
	Box     *crypto.SecretBox
	PDSBase string
}

func NewAuth(store *db.Store, box *crypto.SecretBox, pds string) *Auth {
	return &Auth{Store: store, Box: box, PDSBase: pds}
}

// --- request types ---
type loginReq struct {
	Identifier  string `json:"identifier"`  // handle or email (no @ needed)
	AppPassword string `json:"appPassword"` // app password only
	PDSBase     string `json:"pdsBase,omitempty"`
}

type atpSession struct {
	DID         string `json:"did"`
	Handle      string `json:"handle"`
	AccessJwt   string `json:"accessJwt"`
	RefreshJwt  string `json:"refreshJwt"`
	ActiveUntil string `json:"activeUntil"`
}

// --- small helpers ---

func parseActiveUntil(s string) time.Time {
	if s == "" {
		return time.Now().Add(6 * time.Hour)
	}
	t, _ := time.Parse(time.RFC3339, s)
	if t.IsZero() {
		return time.Now().Add(6 * time.Hour)
	}
	return t
}

func isLocalhostHost(host string) bool {
	h := strings.Split(host, ":")[0]
	return h == "localhost" || h == "127.0.0.1" || h == "::1"
}

func wantSecureCookie(r *http.Request) bool {
	if v := os.Getenv("COOKIE_SECURE"); v != "" {
		return strings.ToLower(v) != "false"
	}
	if r.TLS != nil {
		return true
	}
	if isLocalhostHost(r.Host) {
		return false
	}
	return true
}

func fallbackUsername(name string) string {
	n := strings.TrimSpace(name)
	if n == "" {
		return "user" + uuid.NewString()[:8]
	}
	return strings.ToLower(strings.ReplaceAll(n, " ", "_"))
}

func toJSONB(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// --- Bluesky login (server-side) ---

func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var in loginReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	pds := in.PDSBase
	if pds == "" {
		pds = a.PDSBase
	}

	payload, _ := json.Marshal(map[string]string{
		"identifier": in.Identifier,
		"password":   in.AppPassword,
	})
	req, _ := http.NewRequest("POST", pds+"/xrpc/com.atproto.server.createSession", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "pds error", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	var ses atpSession
	_ = json.NewDecoder(resp.Body).Decode(&ses)

	// encrypt tokens (store as base64 text)
	encAccess, _ := a.Box.Seal([]byte(ses.AccessJwt))
	encRefresh, _ := a.Box.Seal([]byte(ses.RefreshJwt))
	encAccessB64 := base64.StdEncoding.EncodeToString(encAccess)
	encRefreshB64 := base64.StdEncoding.EncodeToString(encRefresh)
	expires := parseActiveUntil(ses.ActiveUntil)

	// find or create user
	var userID uuid.UUID
	err = a.Store.Pool.QueryRow(r.Context(), `
	  SELECT user_id FROM app.accounts WHERE provider = $1 AND provider_account_id = $2
	`, "bluesky", ses.DID).Scan(&userID)
	if err != nil {
		_ = a.Store.Pool.QueryRow(r.Context(), `
		  INSERT INTO app.users (name, username, created_at, updated_at)
		  VALUES ($1, $2, now(), now())
		  RETURNING id
		`, ses.Handle, ses.Handle).Scan(&userID)
	}

	// upsert account
	providerData, _ := json.Marshal(map[string]string{"handle": ses.Handle, "pds_base": pds})
	var accountID uuid.UUID
	_ = a.Store.Pool.QueryRow(r.Context(), `
	  INSERT INTO app.accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, provider_data, created_at, updated_at)
	  VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
	  ON CONFLICT (provider, provider_account_id) DO UPDATE SET
	    user_id = EXCLUDED.user_id,
	    access_token = EXCLUDED.access_token,
	    refresh_token = EXCLUDED.refresh_token,
	    expires_at = EXCLUDED.expires_at,
	    provider_data = EXCLUDED.provider_data,
	    updated_at = now()
	  RETURNING id
	`, userID, "bluesky", ses.DID, encAccessB64, encRefreshB64, expires, providerData).Scan(&accountID)

	// create session
	sid := uuid.New().String()
	sessionExpiry := time.Now().Add(30 * 24 * time.Hour)

	if _, err := a.Store.Pool.Exec(r.Context(), `
	  INSERT INTO app.sessions (session_token, user_id, expires_at, created_at, last_seen_at)
	  VALUES ($1,$2,$3, now(), now())
	`, sid, userID, sessionExpiry); err != nil {
    log.Printf("[auth] failed to insert session: %v", err)
	}


	// set cookie
	c := &http.Cookie{
		Name:     "ink_sid",
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		Secure:   wantSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
		Expires:  sessionExpiry,
	}
	if d := os.Getenv("COOKIE_DOMAIN"); d != "" {
		c.Domain = d
	}
	http.SetCookie(w, c)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"did": ses.DID, "handle": ses.Handle})
}

// Logout
func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if sid, err := r.Cookie("ink_sid"); err == nil {
		_, _ = a.Store.Pool.Exec(r.Context(), `DELETE FROM app.sessions WHERE session_token=$1`, sid.Value)
	}
	c := &http.Cookie{
		Name:     "ink_sid",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   wantSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	}
	if d := os.Getenv("COOKIE_DOMAIN"); d != "" {
		c.Domain = d
	}
	http.SetCookie(w, c)
	w.WriteHeader(http.StatusNoContent)
}

// Me
func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
	sd, err := a.ResolveSession(r)
	if err != nil || sd == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"did":     sd.DID,
		"handle":  sd.Handle,
		"pds":     sd.PDSBase,
		"user_id": sd.UserID.String(),
	})
}

// --- OAuth helpers ---

func oauthConfigFor(provider string) (*oauth2.Config, error) {
	switch provider {
	case "github":
		cid := os.Getenv("GITHUB_CLIENT_ID")
		secret := os.Getenv("GITHUB_CLIENT_SECRET")
		redirect := os.Getenv("GITHUB_REDIRECT_URL")
		if cid == "" || secret == "" || redirect == "" {
			return nil, errors.New("github oauth not configured")
		}
		return &oauth2.Config{
			ClientID:     cid,
			ClientSecret: secret,
			Endpoint:     github.Endpoint,
			RedirectURL:  redirect,
			Scopes:       []string{"read:user", "user:email"},
		}, nil
	case "google":
		cid := os.Getenv("GOOGLE_CLIENT_ID")
		secret := os.Getenv("GOOGLE_CLIENT_SECRET")
		redirect := os.Getenv("GOOGLE_REDIRECT_URL")
		if cid == "" || secret == "" || redirect == "" {
			return nil, errors.New("google oauth not configured")
		}
		return &oauth2.Config{
			ClientID:     cid,
			ClientSecret: secret,
			Endpoint:     google.Endpoint,
			RedirectURL:  redirect,
			Scopes:       []string{"openid", "email", "profile"},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

func oauthState() (string, error) {
	b := make([]byte, 16)
	if _, err := crand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Minimal user info returned from providers
type UserInfo struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

// fetchUserInfo queries provider userinfo endpoints using the token
func fetchUserInfo(provider string, tok *oauth2.Token) (*UserInfo, error) {
	client := oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(tok))

	switch provider {
	case "google":
		resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var data struct {
			ID      string `json:"id"`
			Email   string `json:"email"`
			Name    string `json:"name"`
			Picture string `json:"picture"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
			return nil, err
		}
		return &UserInfo{ID: data.ID, Email: data.Email, Name: data.Name, Avatar: data.Picture}, nil

	case "github":
		// basic user
		resp, err := client.Get("https://api.github.com/user")
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var d struct {
			ID        int64  `json:"id"`
			Login     string `json:"login"`
			Name      string `json:"name"`
			Email     string `json:"email"`
			AvatarURL string `json:"avatar_url"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&d); err != nil {
			return nil, err
		}
		email := d.Email
		// github may not return public email; try /user/emails if needed (omitted for brevity)
		return &UserInfo{ID: fmt.Sprint(d.ID), Email: email, Name: d.Name, Avatar: d.AvatarURL}, nil

	default:
		return nil, fmt.Errorf("unsupported provider %q", provider)
	}
}

// --- OAuth Start & Callback ---

func (a *Auth) OAuthStart(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	cfg, err := oauthConfigFor(provider)
	if err != nil {
		http.Error(w, "oauth config error: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := oauthState()
	if err != nil {
		http.Error(w, "failed to create state", http.StatusInternalServerError)
		return
	}

	// preserve SPA preference if present
	respPref := r.URL.Query().Get("response") // e.g. "json"
	val := provider + "|" + state
	if respPref != "" {
		val = val + "|" + respPref
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    val,
		Path:     "/",
		HttpOnly: true,
		Secure:   wantSecureCookie(r),
		Expires:  time.Now().Add(10 * time.Minute),
		SameSite: http.SameSiteLaxMode,
	})

	opts := []oauth2.AuthCodeOption{}
	if provider == "google" {
		opts = append(opts, oauth2.AccessTypeOffline)
	}
	url := cfg.AuthCodeURL(state, opts...)
	http.Redirect(w, r, url, http.StatusFound)
}

func (a *Auth) OAuthCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	provider := chi.URLParam(r, "provider")
	cfg, err := oauthConfigFor(provider)
	if err != nil {
		http.Error(w, "oauth config error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// read state cookie
	sc, err := r.Cookie("oauth_state")
	if err != nil {
		http.Error(w, "missing state cookie", http.StatusBadRequest)
		return
	}
	parts := strings.SplitN(sc.Value, "|", 3)
	if len(parts) < 2 || parts[0] != provider {
		http.Error(w, "invalid state cookie", http.StatusBadRequest)
		return
	}
	savedState := parts[1]
	savedRespPref := ""
	if len(parts) == 3 {
		savedRespPref = parts[2]
	}
	if r.URL.Query().Get("state") != savedState {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}

	// exchange code
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}
	tok, err := cfg.Exchange(ctx, code)
	if err != nil {
		http.Error(w, "token exchange failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	// fetch profile
	userInfo, err := fetchUserInfo(provider, tok)
	if err != nil {
		http.Error(w, "failed to fetch user info: "+err.Error(), http.StatusInternalServerError)
		return
	}
	email, name, avatar, providerAccountID := userInfo.Email, userInfo.Name, userInfo.Avatar, userInfo.ID

	// upsert user
	var userID uuid.UUID
	err = a.Store.Pool.QueryRow(ctx, `SELECT user_id FROM app.accounts WHERE provider=$1 AND provider_account_id=$2`, provider, providerAccountID).Scan(&userID)
	if err != nil {
		if email != "" {
			_ = a.Store.Pool.QueryRow(ctx, `SELECT id FROM app.users WHERE email=$1`, email).Scan(&userID)
		}
		if userID == uuid.Nil {
			_ = a.Store.Pool.QueryRow(ctx, `INSERT INTO app.users (email, name, username, avatar_url, created_at, updated_at) VALUES ($1,$2,$3,$4, now(), now()) RETURNING id`, email, name, fallbackUsername(name), avatar).Scan(&userID)
		}
	}

	// store tokens (encrypted)
	encAccess := ""
	encRefresh := ""
	if tok.AccessToken != "" {
		if sealed, err := a.Box.Seal([]byte(tok.AccessToken)); err == nil {
			encAccess = base64.StdEncoding.EncodeToString(sealed)
		}
	}
	if tok.RefreshToken != "" {
		if sealed, err := a.Box.Seal([]byte(tok.RefreshToken)); err == nil {
			encRefresh = base64.StdEncoding.EncodeToString(sealed)
		}
	}

	_, _ = a.Store.Pool.Exec(ctx, `INSERT INTO app.accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, provider_data, created_at, updated_at)
	 VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
	 ON CONFLICT (provider, provider_account_id) DO UPDATE SET access_token=$4, refresh_token=$5, expires_at=$6, provider_data=$7, updated_at=now()`,
		userID, provider, providerAccountID, encAccess, encRefresh, tok.Expiry, toJSONB(userInfo))

	// create session
	sessionToken := uuid.New().String()
	sessionExpiry := time.Now().Add(30 * 24 * time.Hour)
	if _, err := a.Store.Pool.Exec(ctx, `INSERT INTO app.sessions (session_token, user_id, expires_at, created_at, last_seen_at) VALUES ($1,$2,$3, now(), now())`, sessionToken, userID, sessionExpiry); err != nil {
    log.Printf("[auth] failed to insert session: %v", err)
	}


	// set cookie
	c := &http.Cookie{Name: "ink_sid", Value: sessionToken, Path: "/", HttpOnly: true, Secure: wantSecureCookie(r), SameSite: http.SameSiteLaxMode, Expires: sessionExpiry}
	if d := os.Getenv("COOKIE_DOMAIN"); d != "" {
		c.Domain = d
	}
	http.SetCookie(w, c)

	// clear oauth_state
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", HttpOnly: true, Expires: time.Now().Add(-1 * time.Hour)})

	// respond
	if savedRespPref == "json" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `<!doctype html>
		<html>
		<head><meta charset="utf-8"></head>
		<body>
		<script>
		console.log("OAuth popup sending postMessage to opener");
		try {
			window.opener.postMessage({ type: 'oauth-success' }, window.opener.location.origin);
		} catch(e) {
			console.error("postMessage failed", e);
		}
		window.close();
		</script>
		<p>Authentication complete — you can close this window.</p>
		</body>
		</html>`)
		return
	}

	redirectTarget := os.Getenv("OAUTH_SUCCESS_REDIRECT")
	if redirectTarget == "" {
		redirectTarget = "http://localhost:3000/"
	}
	http.Redirect(w, r, redirectTarget, http.StatusFound)
}

// --- Account management ---

func (a *Auth) UnlinkAccount(w http.ResponseWriter, r *http.Request) {
	sd, err := a.ResolveSession(r)
	if err != nil || sd == nil || sd.UserID == uuid.Nil {
		http.Error(w, "unauthenticated", http.StatusUnauthorized)
		return
	}

	var in struct{ Provider string `json:"provider"` }
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Provider == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	var count int
	if err := a.Store.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM app.accounts WHERE user_id = $1`, sd.UserID).Scan(&count); err == nil {
		if count <= 1 {
			http.Error(w, "cannot unlink last provider", http.StatusBadRequest)
			return
		}
	}

	if _, err := a.Store.Pool.Exec(r.Context(), `DELETE FROM app.accounts WHERE user_id = $1 AND provider = $2`, sd.UserID, in.Provider); err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *Auth) ListAccounts(w http.ResponseWriter, r *http.Request) {
	sd, err := a.ResolveSession(r)
	if err != nil || sd == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rows, err := a.Store.Pool.Query(r.Context(), `SELECT provider, provider_account_id, provider_data, created_at, updated_at FROM app.accounts WHERE user_id=$1 ORDER BY updated_at DESC`, sd.UserID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var provider, provAcct string
		var pdBytes []byte
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&provider, &provAcct, &pdBytes, &createdAt, &updatedAt); err != nil {
			continue
		}
		pd := map[string]any{}
		_ = json.Unmarshal(pdBytes, &pd)
		out = append(out, map[string]any{
			"provider":             provider,
			"provider_account_id":  provAcct,
			"provider_data":        pd,
			"created_at":           createdAt,
			"updated_at":           updatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// ListNeedsReauth admin endpoint
func (a *Auth) ListNeedsReauth(w http.ResponseWriter, r *http.Request) {
	adminToken := os.Getenv("ADMIN_TOKEN")
	if adminToken == "" {
		http.Error(w, "admin endpoint not enabled", http.StatusForbidden)
		return
	}
	if r.Header.Get("X-Admin-Token") != adminToken {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	rows, err := a.Store.Pool.Query(r.Context(), `
		SELECT accounts.id, accounts.provider, accounts.provider_account_id, accounts.user_id, users.email, users.name, accounts.provider_data, accounts.updated_at
		FROM app.accounts
		LEFT JOIN app.users ON app.users.id = app.accounts.user_id
		WHERE (provider_data->>'needs_reauth') = 'true'
		ORDER BY accounts.updated_at DESC
		LIMIT 500
	`)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var id uuid.UUID
		var provider, provAcct string
		var userID uuid.UUID
		var email, name string
		var pdBytes []byte
		var updated time.Time
		if err := rows.Scan(&id, &provider, &provAcct, &userID, &email, &name, &pdBytes, &updated); err != nil {
			continue
		}
		pd := map[string]any{}
		_ = json.Unmarshal(pdBytes, &pd)
		out = append(out, map[string]any{
			"id":                  id.String(),
			"provider":            provider,
			"provider_account_id": provAcct,
			"user_id":             userID.String(),
			"user_email":          email,
			"user_name":           name,
			"provider_data":       pd,
			"updated_at":          updated,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (a *Auth) StartTokenRefresher(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Minute) // adjust interval
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // Refresh logic here
            err := a.refreshAllTokens()
            if err != nil {
                // log error
            }
        }
    }
}

func (a *Auth) refreshAllTokens() error {
	ctx := context.Background()
	accounts, err := a.Store.GetAllSessionsWithAccounts(ctx)
	if err != nil {
		return err
	}

	for _, acct := range accounts {
		// skip if token not near expiry
		if acct.ExpiresAt.After(time.Now().Add(5 * time.Minute)) {
			continue
		}

		// decrypt refresh token
		if acct.RefreshTokenEnc == "" {
			continue
		}
		raw, err := base64.StdEncoding.DecodeString(acct.RefreshTokenEnc)
		if err != nil {
			continue
		}
		refreshPlain, err := a.Box.Open(raw)
		if err != nil {
			continue
		}

		// load provider config
		cfg, err := oauthConfigFor(acct.Provider)
		if err != nil {
			continue
		}

		// try refresh
		tok := &oauth2.Token{
			RefreshToken: string(refreshPlain),
			Expiry:       acct.ExpiresAt,
		}
		newTok, err := cfg.TokenSource(ctx, tok).Token()
		if err != nil {
			// mark account as needing reauth
			_, _ = a.Store.Pool.Exec(ctx,
				`UPDATE accounts SET provider_data = jsonb_set(coalesce(provider_data,'{}'::jsonb), '{needs_reauth}', '"true"') WHERE user_id=$1 AND provider=$2`,
				acct.UserID, acct.Provider)
			continue
		}

		// re-encrypt new tokens
		encAccess := ""
		encRefresh := ""
		if newTok.AccessToken != "" {
			if sealed, err := a.Box.Seal([]byte(newTok.AccessToken)); err == nil {
				encAccess = base64.StdEncoding.EncodeToString(sealed)
			}
		}
		if newTok.RefreshToken != "" {
			if sealed, err := a.Box.Seal([]byte(newTok.RefreshToken)); err == nil {
				encRefresh = base64.StdEncoding.EncodeToString(sealed)
			}
		} else {
			// keep old refresh token if provider didn’t return a new one
			encRefresh = acct.RefreshTokenEnc
		}

		// update DB
		_, _ = a.Store.Pool.Exec(ctx,
			`UPDATE accounts SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=now()
			 WHERE user_id=$4 AND provider=$5`,
			encAccess, encRefresh, newTok.Expiry, acct.UserID, acct.Provider)
	}

	return nil
}


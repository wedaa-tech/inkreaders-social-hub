package http

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
	"errors"
	"strings"
	"log"

	"github.com/google/uuid"
)

// ResolveSession resolves the ink_sid cookie (session_token) to session + account details.
// It expects sessions to be stored as (session_token, user_id, expires_at, created_at, last_seen_at)
// and will prefer to populate account info from the user's Bluesky account (provider='bluesky').
// Returns an error if session not found or expired.
// ResolveSession resolves ink_sid -> session+account data with detailed logging.
func (a *Auth) ResolveSession(r *http.Request) (*SessionData, error) {
    ctx := r.Context()

    // 0) cookie
    c, err := r.Cookie("ink_sid")
    if err != nil {
        // named cookie not present
        // do not spam user errors, just return; keep a clear debug line
        log.Printf("[auth] %s no ink_sid cookie: %v", r.URL.Path, err)
        return nil, err
    }
    sessTok := strings.TrimSpace(c.Value)
    if sessTok == "" {
        log.Printf("[auth] %s empty ink_sid cookie value", r.URL.Path)
        return nil, errors.New("no session token")
    }
    log.Printf("[auth] %s cookie ink_sid=%s", r.URL.Path, sessTok)

    // 1) session lookup (SCHEMA-QUALIFIED)
    var userID uuid.UUID
    var sessExpires time.Time
    err = a.Store.Pool.QueryRow(ctx, `
        SELECT user_id, expires_at
        FROM app.sessions
        WHERE session_token = $1
        LIMIT 1
    `, sessTok).Scan(&userID, &sessExpires)
    if err != nil {
        log.Printf("[auth] %s no session for token=%s: %v", r.URL.Path, sessTok, err)
        return nil, err
    }
    log.Printf("[auth] %s session user_id=%s expires_at=%s", r.URL.Path, userID, sessExpires.Format(time.RFC3339))

    // 2) expiry
    now := time.Now()
    if !sessExpires.IsZero() && now.After(sessExpires) {
        log.Printf("[auth] %s session expired token=%s (expires=%s now=%s)", r.URL.Path, sessTok, sessExpires, now)
        // SCHEMA-QUALIFIED delete
        _, _ = a.Store.Pool.Exec(ctx, `DELETE FROM app.sessions WHERE session_token = $1`, sessTok)
        return nil, errors.New("session expired")
    }

    sd := &SessionData{UserID: userID}

    // 3) Try bluesky account first (SCHEMA-QUALIFIED)
    var acctID uuid.UUID
    var provider, provAcctID string
    var provData []byte
    var encAccessB64, encRefreshB64 string
    var acctExpires time.Time
    err = a.Store.Pool.QueryRow(ctx, `
        SELECT id, provider, provider_account_id, provider_data, access_token, refresh_token, expires_at
        FROM app.accounts
        WHERE user_id = $1 AND provider = 'bluesky'
        LIMIT 1
    `, userID).Scan(&acctID, &provider, &provAcctID, &provData, &encAccessB64, &encRefreshB64, &acctExpires)
    if err != nil {
        log.Printf("[auth] %s no bluesky account for user_id=%s: %v (will try any provider)", r.URL.Path, userID, err)
        // try any account
        _ = a.Store.Pool.QueryRow(ctx, `
            SELECT id, provider, provider_account_id, provider_data, access_token, refresh_token, expires_at
            FROM app.accounts
            WHERE user_id = $1
            LIMIT 1
        `, userID).Scan(&acctID, &provider, &provAcctID, &provData, &encAccessB64, &encRefreshB64, &acctExpires)
    }

    if acctID != uuid.Nil {
        sd.AccountID = acctID
        // Populate optional fields
        if len(provData) > 0 {
            var pd map[string]any
            _ = json.Unmarshal(provData, &pd)
            if h, ok := pd["handle"].(string); ok {
                sd.Handle = h
            }
            if p, ok := pd["pds_base"].(string); ok {
                sd.PDSBase = p
            }
        }
        // Decrypt tokens best-effort
        if encAccessB64 != "" {
            if raw, derr := base64.StdEncoding.DecodeString(encAccessB64); derr == nil {
                if plain, oerr := a.Box.Open(raw); oerr == nil {
                    sd.AccessJWT = string(plain)
                }
            }
        }
        if encRefreshB64 != "" {
            if raw, derr := base64.StdEncoding.DecodeString(encRefreshB64); derr == nil {
                if plain, oerr := a.Box.Open(raw); oerr == nil {
                    sd.RefreshJWT = string(plain)
                }
            }
        }
        if !acctExpires.IsZero() {
            sd.ExpiresAt = acctExpires
        }
    }

    // 4) touch last_seen (SCHEMA-QUALIFIED)
    _, _ = a.Store.Pool.Exec(ctx, `UPDATE app.sessions SET last_seen_at = now() WHERE session_token = $1`, sessTok)

    return sd, nil
}

// Require a valid session
func (a *Auth) WithSession(next func(http.ResponseWriter, *http.Request, *SessionData)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s, err := a.ResolveSession(r)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r, s)
	}
}

// Pass session when available; otherwise nil
func (a *Auth) WithSessionOptional(next func(http.ResponseWriter, *http.Request, *SessionData)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s, _ := a.ResolveSession(r) // nil on failure
		next(w, r, s)
	}
}

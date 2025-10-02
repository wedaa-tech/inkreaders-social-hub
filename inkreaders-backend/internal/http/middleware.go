package http

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
	"errors"
	"strings"

	"github.com/google/uuid"
)

// ResolveSession resolves the ink_sid cookie (session_token) to session + account details.
// It expects sessions to be stored as (session_token, user_id, expires_at, created_at, last_seen_at)
// and will prefer to populate account info from the user's Bluesky account (provider='bluesky').
// Returns an error if session not found or expired.
func (a *Auth) ResolveSession(r *http.Request) (*SessionData, error) {
	// cookie
	c, err := r.Cookie("ink_sid")
	if err != nil {
		return nil, err
	}
	sessTok := strings.TrimSpace(c.Value)
	if sessTok == "" {
		return nil, errors.New("no session token")
	}

	ctx := r.Context()

	// 1) lookup session -> get user_id and expires_at
	var userID uuid.UUID
	var sessExpires time.Time
	err = a.Store.Pool.QueryRow(ctx, `
		SELECT user_id, expires_at
		FROM sessions
		WHERE session_token = $1
		LIMIT 1
	`, sessTok).Scan(&userID, &sessExpires)
	if err != nil {
		return nil, err
	}

	// 2) check expiry if set
	if !sessExpires.IsZero() && time.Now().After(sessExpires) {
		// session expired: delete and return error
		_, _ = a.Store.Pool.Exec(ctx, `DELETE FROM sessions WHERE session_token = $1`, sessTok)
		return nil, errors.New("session expired")
	}

	sd := &SessionData{
		UserID: userID,
	}

	// 3) Prefer to fetch the user's Bluesky account to populate provider-specific fields
	var acctID uuid.UUID
	var provider, provAcctID string
	var provData []byte
	var encAccessB64, encRefreshB64 string
	var acctExpires time.Time

	err = a.Store.Pool.QueryRow(ctx, `
		SELECT id, provider, provider_account_id, provider_data, access_token, refresh_token, expires_at
		FROM accounts
		WHERE user_id = $1 AND provider = 'bluesky'
		LIMIT 1
	`, userID).Scan(&acctID, &provider, &provAcctID, &provData, &encAccessB64, &encRefreshB64, &acctExpires)

	if err == nil {
		// populate from bluesky account row
		sd.AccountID = acctID
		sd.DID = provAcctID
		// provider_data (JSON) may contain handle/pds_base
		var pd map[string]any
		_ = json.Unmarshal(provData, &pd)
		if h, ok := pd["handle"].(string); ok {
			sd.Handle = h
		}
		if p, ok := pd["pds_base"].(string); ok {
			sd.PDSBase = p
		}
		// decrypt access token
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
	} else {
		// no bluesky account found - try to pick any account row for this user (non-fatal)
		err2 := a.Store.Pool.QueryRow(ctx, `
			SELECT id, provider, provider_account_id, provider_data, access_token, refresh_token, expires_at
			FROM accounts
			WHERE user_id = $1
			LIMIT 1
		`, userID).Scan(&acctID, &provider, &provAcctID, &provData, &encAccessB64, &encRefreshB64, &acctExpires)
		if err2 == nil {
			sd.AccountID = acctID
			var pd map[string]any
			_ = json.Unmarshal(provData, &pd)
			if h, ok := pd["handle"].(string); ok {
				sd.Handle = h
			}
			if p, ok := pd["pds_base"].(string); ok {
				sd.PDSBase = p
			}
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
	}

	// 4) update last_seen_at (best-effort)
	_, _ = a.Store.Pool.Exec(ctx, `UPDATE sessions SET last_seen_at = now() WHERE session_token = $1`, sessTok)

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

package http

import (
	"encoding/json"
	"net/http"
	"time"
)

// NOTE: We no longer need SessionMiddleware; Auth already holds Store & Box.
// type SessionMiddleware struct { ... }  // <-- delete this struct if present

func (a *Auth) ResolveSession(r *http.Request) (*SessionData, error) {
	sid, err := r.Cookie("ink_sid")
	if err != nil {
		return nil, err
	}

	var sd SessionData
	var encA, encR []byte

	row := a.Store.Pool.QueryRow(r.Context(), `
	  select a.id, a.did, a.handle, a.pds_base, a.access_jwt, a.refresh_jwt, a.session_expires_at
	  from sessions s join accounts a on s.account_id = a.id
	  where s.id = $1
	`, sid.Value)

	if err := row.Scan(&sd.AccountID, &sd.DID, &sd.Handle, &sd.PDSBase, &encA, &encR, &sd.ExpiresAt); err != nil {
		return nil, err
	}

	plainA, _ := a.Box.Open(encA)
	plainR, _ := a.Box.Open(encR)
	sd.AccessJWT = string(plainA)
	sd.RefreshJWT = string(plainR)

	// Refresh if near expiry (5m window)
	if time.Until(sd.ExpiresAt) < 5*time.Minute {
		req, _ := http.NewRequestWithContext(r.Context(), "POST", sd.PDSBase+"/xrpc/com.atproto.server.refreshSession", nil)
		req.Header.Set("Authorization", "Bearer "+sd.RefreshJWT)
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				var ses struct {
					AccessJwt   string `json:"accessJwt"`
					RefreshJwt  string `json:"refreshJwt"`
					ActiveUntil string `json:"activeUntil"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&ses)

				encAccess, _ := a.Box.Seal([]byte(ses.AccessJwt))
				encRefresh, _ := a.Box.Seal([]byte(ses.RefreshJwt))

				sd.AccessJWT = ses.AccessJwt
				sd.RefreshJWT = ses.RefreshJwt
				sd.ExpiresAt = parseActiveUntil(ses.ActiveUntil)

				// Persist new tokens
				_, _ = a.Store.Pool.Exec(r.Context(), `
				  update accounts
				  set access_jwt = $1,
				      refresh_jwt = $2,
				      session_expires_at = $3,
				      updated_at = now()
				  where id = $4
				`, encAccess, encRefresh, sd.ExpiresAt, sd.AccountID)
			}
		}
	}

	return &sd, nil
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

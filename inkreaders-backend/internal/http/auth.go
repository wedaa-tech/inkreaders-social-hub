package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/crypto"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type SessionData struct {
	AccountID  string
	DID        string
	Handle     string
	PDSBase    string
	AccessJWT  string
	RefreshJWT string
	ExpiresAt  time.Time
}

type Auth struct {
	Store   *db.Store
	Box     *crypto.SecretBox
	PDSBase string
}

func NewAuth(store *db.Store, box *crypto.SecretBox, pds string) *Auth {
	return &Auth{Store: store, Box: box, PDSBase: pds}
}

type loginReq struct {
	Identifier  string `json:"identifier"`   // @handle or email
	AppPassword string `json:"appPassword"`  // app password only
	PDSBase     string `json:"pdsBase,omitempty"`
}

type atpSession struct {
	DID         string `json:"did"`
	Handle      string `json:"handle"`
	AccessJwt   string `json:"accessJwt"`
	RefreshJwt  string `json:"refreshJwt"`
	ActiveUntil string `json:"activeUntil"`
}

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

	// call com.atproto.server.createSession
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

	encAccess, _ := a.Box.Seal([]byte(ses.AccessJwt))
	encRefresh, _ := a.Box.Seal([]byte(ses.RefreshJwt))
	expires := parseActiveUntil(ses.ActiveUntil)

	var accountID string
	err = a.Store.Pool.QueryRow(r.Context(), `
	  insert into accounts (did, handle, display_name, avatar_url, pds_base, access_jwt, refresh_jwt, session_expires_at)
	  values ($1,$2,$3,$4,$5,$6,$7,$8)
	  on conflict (did) do update set
	    handle=excluded.handle,
	    pds_base=excluded.pds_base,
	    access_jwt=excluded.access_jwt,
	    refresh_jwt=excluded.refresh_jwt,
	    session_expires_at=excluded.session_expires_at,
	    updated_at=now()
	  returning id
	`, ses.DID, ses.Handle, "", "", pds, encAccess, encRefresh, expires).Scan(&accountID)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sid := uuid.New().String()
	if _, err := a.Store.Pool.Exec(r.Context(), `insert into sessions (id, account_id) values ($1,$2)`, sid, accountID); err != nil {
    http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
    return
	}

	c := &http.Cookie{
		Name:     "ink_sid",
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(30 * 24 * time.Hour),
	}
	if d := os.Getenv("COOKIE_DOMAIN"); d != "" {
		c.Domain = d
	}
	c.Secure = os.Getenv("COOKIE_DOMAIN") != ""
	
	http.SetCookie(w, c)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"did": ses.DID, "handle": ses.Handle,
	})
}

func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if sid, err := r.Cookie("ink_sid"); err == nil {
		_, _ = a.Store.Pool.Exec(r.Context(),
			`delete from sessions where id=$1`, sid.Value)
		sid.MaxAge = -1
		http.SetCookie(w, sid)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
	sd, err := a.ResolveSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"did": sd.DID, "handle": sd.Handle, "pds": sd.PDSBase,
	})
}

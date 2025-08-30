// internal/http/handlers_profiles.go
package http

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/bluesky-social/indigo/xrpc"
)

// --- PostStats ---
func (h *Handlers) PostStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uri := r.URL.Query().Get("uri")
	if uri == "" {
		http.Error(w, "uri required", http.StatusBadRequest)
		return
	}

	params := map[string]any{"uris": []string{uri}}

	var out struct {
		Posts []struct {
			Uri         string `json:"uri"`
			Cid         string `json:"cid"`
			LikeCount   int    `json:"likeCount"`
			RepostCount int    `json:"repostCount"`
			ReplyCount  int    `json:"replyCount"`
		} `json:"posts"`
	}

	if err := h.agent.Do(ctx, xrpc.Query, "", "app.bsky.feed.getPosts", params, nil, &out); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if len(out.Posts) == 0 {
		_ = json.NewEncoder(w).Encode(map[string]int{"likes": 0, "reposts": 0, "replies": 0})
		return
	}

	p := out.Posts[0]
	_ = json.NewEncoder(w).Encode(map[string]int{
		"likes":   p.LikeCount,
		"reposts": p.RepostCount,
		"replies": p.ReplyCount,
	})
}

// --- Timeline ---
func (h *Handlers) Timeline(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	q := r.URL.Query()

	limit := q.Get("limit")
	if limit == "" {
		limit = "30"
	}
	cursor := q.Get("cursor")

	source := strings.ToLower(strings.TrimSpace(q.Get("source")))
	if source == "" {
		source = "auto"
	}

	useUser := false
	switch source {
	case "user":
		if s == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		useUser = true
	case "app":
		useUser = false
	default:
		useUser = (s != nil)
	}

	if useUser {
		u := s.PDSBase + "/xrpc/app.bsky.feed.getTimeline?limit=" + limit
		if cursor != "" {
			u += "&cursor=" + cursor
		}

		req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
		req.Header.Set("Authorization", "Bearer "+s.AccessJWT)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			http.Error(w, string(b), http.StatusBadGateway)
			return
		}

		w.Header().Set("X-IR-Source", "user")
		w.Header().Set("X-IR-Handle", s.Handle)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(w, resp.Body)
		return
	}

	params := map[string]any{"limit": limit}
	if cursor != "" {
		params["cursor"] = cursor
	}

	var out map[string]any
	if err := h.agent.Do(ctx, xrpc.Query, "", "app.bsky.feed.getTimeline", params, nil, &out); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-IR-Source", "app")
	w.Header().Set("X-IR-Handle", h.did)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// --- Who ---
func (h *Handlers) Who(w http.ResponseWriter, r *http.Request, s *SessionData) {
	resp := map[string]any{
		"hasSession": s != nil,
	}
	if s != nil {
		resp["did"] = s.DID
		resp["handle"] = s.Handle
		resp["pds"] = s.PDSBase
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// --- Profile DTOs ---
type profileOut struct {
	DID         string  `json:"did"`
	Handle      string  `json:"handle"`
	DisplayName string  `json:"displayName"`
	AvatarURL   string  `json:"avatarUrl"`
	Bio         string  `json:"bio"`
	Remote      struct {
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		Description string `json:"description"`
	} `json:"remote"`
}

type profileUpdateIn struct {
	DisplayName *string `json:"displayName,omitempty"`
	Bio         *string `json:"bio,omitempty"`
	AvatarURL   *string `json:"avatarUrl,omitempty"`
}

// --- ProfileGet ---
func (h *Handlers) ProfileGet(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()

	var local struct {
		DisplayName string
		AvatarURL   string
		Bio         string
		Handle      string
	}
	err := h.Store.Pool.QueryRow(ctx, `
		select coalesce(display_name,''), coalesce(avatar_url,''), coalesce(bio,''), handle
		from accounts where id=$1
	`, s.AccountID).Scan(&local.DisplayName, &local.AvatarURL, &local.Bio, &local.Handle)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}

	var remote struct {
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		Description string `json:"description"`
	}
	u := s.PDSBase + "/xrpc/app.bsky.actor.getProfile?actor=" + s.DID
	req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
	req.Header.Set("Authorization", "Bearer "+s.AccessJWT)
	if resp, err := http.DefaultClient.Do(req); err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		_ = json.NewDecoder(resp.Body).Decode(&remote)
	}

	out := profileOut{
		DID:         s.DID,
		Handle:      local.Handle,
		DisplayName: local.DisplayName,
		AvatarURL:   local.AvatarURL,
		Bio:         local.Bio,
	}
	out.Remote.DisplayName = remote.DisplayName
	out.Remote.Avatar = remote.Avatar
	out.Remote.Description = remote.Description

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// --- ProfileUpdate ---
func (h *Handlers) ProfileUpdate(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in profileUpdateIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	q := "update accounts set "
	args := []any{}
	set := []string{}
	if in.DisplayName != nil {
		set = append(set, "display_name=$"+fmt.Sprint(len(args)+1))
		args = append(args, *in.DisplayName)
	}
	if in.AvatarURL != nil {
		set = append(set, "avatar_url=$"+fmt.Sprint(len(args)+1))
		args = append(args, *in.AvatarURL)
	}
	if in.Bio != nil {
		set = append(set, "bio=$"+fmt.Sprint(len(args)+1))
		args = append(args, *in.Bio)
	}
	if len(set) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	q += strings.Join(set, ", ") + ", updated_at=now() where id=$" + fmt.Sprint(len(args)+1)
	args = append(args, s.AccountID)

	if _, err := h.Store.Pool.Exec(ctx, q, args...); err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Prefs ---
type prefs struct {
	DefaultFeed string `json:"defaultFeed"`
}

func (h *Handlers) PrefsGet(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var p prefs
	err := h.Store.Pool.QueryRow(ctx, `
		select default_feed from user_prefs where user_id=$1
	`, s.AccountID).Scan(&p.DefaultFeed)
	if err != nil {
		p.DefaultFeed = "app"
	}
	_ = json.NewEncoder(w).Encode(p)
}

func (h *Handlers) PrefsUpdate(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in prefs
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if in.DefaultFeed != "app" && in.DefaultFeed != "user" {
		http.Error(w, "invalid defaultFeed", http.StatusBadRequest)
		return
	}
	_, _ = h.Store.Pool.Exec(ctx, `
		insert into user_prefs (user_id, default_feed)
		values ($1,$2)
		on conflict (user_id) do update set default_feed=excluded.default_feed, updated_at=now()
	`, s.AccountID, in.DefaultFeed)
	w.WriteHeader(http.StatusNoContent)
}

// --- ProfileSyncFromRemote ---
func (h *Handlers) ProfileSyncFromRemote(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	u := s.PDSBase + "/xrpc/app.bsky.actor.getProfile?actor=" + s.DID
	req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
	req.Header.Set("Authorization", "Bearer "+s.AccessJWT)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		http.Error(w, "remote fetch failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var remote struct {
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		Description string `json:"description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&remote)

	_, err = h.Store.Pool.Exec(ctx, `
		update accounts
		set display_name=$1, avatar_url=$2, bio=$3, updated_at=now()
		where id=$4
	`, remote.DisplayName, remote.Avatar, remote.Description, s.AccountID)
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

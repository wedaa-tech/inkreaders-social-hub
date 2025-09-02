// internal/http/handlers.go
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/bluesky-social/indigo/xrpc"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/types"
)

// Handlers is the central dependency container for HTTP routes.
type Handlers struct {
	// Agent identity
	agent *xrpc.Client
	did   string

	// Database
	Store *db.Store
	DB    *db.Store

	// Exercise-related deps
	AI      ai.Client
	Pub     Publisher
	Storage Storage
	Extract Extractor
}

// Interfaces --------------------------------------------------------

type Publisher interface {
    PublishExerciseSet(ctx context.Context, s *SessionData, set db.ExerciseSet, allowRemix bool) (string, string, string, error)
    CreateExercisePost(ctx context.Context, s *SessionData, exerciseURI, exerciseCID, title string, previewCount int) error
}



type Extractor interface {
	PlainText(mime string, blob []byte) string
}

type Storage interface {
	Put(ctx context.Context, key string, blob []byte) string
	Read(ctx context.Context, key string) ([]byte, error)
}

// Constructor -------------------------------------------------------

func NewHandlers(agent *xrpc.Client, did string, store *db.Store, aiClient ai.Client, pub Publisher, st Storage, ex Extractor) *Handlers {
	return &Handlers{
		agent:   agent,
		did:     did,
		Store:   store,
		DB:      store,
		AI:      aiClient,
		Pub:     pub,
		Storage: st,
		Extract: ex,
	}
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

func (h *Handlers) doXrpc(ctx context.Context, pdsBase string, bearer string, method string, body any, out any) error {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", pdsBase+"/xrpc/"+method, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		buf, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("xrpc %s failed: status=%d body=%s", method, resp.StatusCode, string(buf))
	}

	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// ------------------------------------------------------------------
// Basic endpoints (health/debug)
// ------------------------------------------------------------------

func (h *Handlers) Healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (h *Handlers) DbSample(w http.ResponseWriter, r *http.Request) {
	type row struct {
		URI        string    `json:"uri"`
		Collection string    `json:"collection"`
		CreatedAt  time.Time `json:"createdAt"`
		BookID     *int64    `json:"bookId"`
	}
	rows, err := h.Store.Pool.Query(r.Context(), `
		SELECT uri, collection, created_at, book_id
		FROM posts
		ORDER BY created_at DESC
		LIMIT 20`)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	var out []row
	for rows.Next() {
		var rr row
		if err := rows.Scan(&rr.URI, &rr.Collection, &rr.CreatedAt, &rr.BookID); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		out = append(out, rr)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"posts": out})
}

// ------------------------------------------------------------------
// InkReaders custom: Book & Article posts
// ------------------------------------------------------------------

func (h *Handlers) PostBook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in types.PostBookIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)

	body := map[string]any{
		"repo":       h.did,
		"collection": "com.inkreaders.book.post",
		"record": map[string]any{
			"$type":     "com.inkreaders.book.post",
			"createdAt": now,
			"text":      in.Text,
			"book": map[string]any{
				"title":   in.Book.Title,
				"authors": in.Book.Authors,
				"isbn10":  in.Book.ISBN10,
				"isbn13":  in.Book.ISBN13,
				"link":    in.Book.Link,
			},
			"rating":   in.Rating,
			"progress": in.Progress,
		},
	}

	var out struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}
	if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
		"com.atproto.repo.createRecord", nil, body, &out); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (h *Handlers) PostArticle(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in types.PostArticleIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)

	body := map[string]any{
		"repo":       h.did,
		"collection": "com.inkreaders.article.post",
		"record": map[string]any{
			"$type":     "com.inkreaders.article.post",
			"createdAt": now,
			"text":      in.Text,
			"article": map[string]any{
				"title":  in.Article.Title,
				"url":    in.Article.URL,
				"source": in.Article.Source,
			},
		},
	}

	var out struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}
	if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
		"com.atproto.repo.createRecord", nil, body, &out); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (h *Handlers) MyBookPosts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	params := map[string]any{
		"repo":       h.did,
		"collection": "com.inkreaders.book.post",
		"limit":      20,
		"reverse":    true,
	}
	var out map[string]any
	if err := h.agent.Do(ctx, xrpc.Query, "", "com.atproto.repo.listRecords", params, nil, &out); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	_ = json.NewEncoder(w).Encode(out)
}

// ------------------------------------------------------------------
// Social actions (Like, Repost, Reply, Follow, Post)
// ------------------------------------------------------------------

type likeIn struct {
	Uri string `json:"uri"`
	Cid string `json:"cid"`
}

func (h *Handlers) Like(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in likeIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		BadRequest(w, "bad json")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)

	body := map[string]any{
		"repo": h.did,
		"collection": "app.bsky.feed.like",
		"record": map[string]any{
			"$type":     "app.bsky.feed.like",
			"createdAt": now,
			"subject":   map[string]any{"uri": in.Uri, "cid": in.Cid},
		},
	}
	var out struct{ URI, CID string }
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			ServerError(w, err)
			return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json", "com.atproto.repo.createRecord", nil, body, &out); err != nil {
			ServerError(w, err)
			return
		}
	}
	WriteJSON(w, http.StatusOK, out)
}

func (h *Handlers) Repost(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in likeIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		BadRequest(w, "bad json")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	body := map[string]any{
		"repo": h.did,
		"collection": "app.bsky.feed.repost",
		"record": map[string]any{
			"$type":     "app.bsky.feed.repost",
			"createdAt": now,
			"subject":   map[string]any{"uri": in.Uri, "cid": in.Cid},
		},
	}
	var out struct{ URI, CID string }
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			ServerError(w, err); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json", "com.atproto.repo.createRecord", nil, body, &out); err != nil {
			ServerError(w, err); return
		}
	}
	WriteJSON(w, http.StatusOK, out)
}

type replyIn struct {
	ParentUri string `json:"parentUri"`
	ParentCid string `json:"parentCid"`
	Text      string `json:"text"`
}
func (h *Handlers) Reply(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in replyIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		BadRequest(w, "bad json"); return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	body := map[string]any{
		"repo": h.did,
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      in.Text,
			"reply": map[string]any{
				"root":   map[string]any{"uri": in.ParentUri, "cid": in.ParentCid},
				"parent": map[string]any{"uri": in.ParentUri, "cid": in.ParentCid},
			},
		},
	}
	var out struct{ URI, CID string }
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			ServerError(w, err); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json", "com.atproto.repo.createRecord", nil, body, &out); err != nil {
			ServerError(w, err); return
		}
	}
	WriteJSON(w, http.StatusOK, out)
}

type followIn struct {
	DidOrHandle string `json:"didOrHandle"`
}
func (h *Handlers) Follow(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in followIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		BadRequest(w, "bad json"); return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	body := map[string]any{
		"repo": h.did,
		"collection": "app.bsky.graph.follow",
		"record": map[string]any{
			"$type":     "app.bsky.graph.follow",
			"createdAt": now,
			"subject":   in.DidOrHandle,
		},
	}
	var out struct{ URI, CID string }
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			ServerError(w, err); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json", "com.atproto.repo.createRecord", nil, body, &out); err != nil {
			ServerError(w, err); return
		}
	}
	WriteJSON(w, http.StatusOK, out)
}

type postIn struct {
	Text string `json:"text"`
}
func (h *Handlers) Post(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in postIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		BadRequest(w, "bad json"); return
	}
	if in.Text == "" {
		BadRequest(w, "text required"); return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	body := map[string]any{
		"repo": h.did,
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      in.Text,
		},
	}
	var out struct{ URI, CID string }
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			ServerError(w, err); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json", "com.atproto.repo.createRecord", nil, body, &out); err != nil {
			ServerError(w, err); return
		}
	}
	WriteJSON(w, http.StatusOK, out)
}

// ------------------------------------------------------------------
// Simple JSON helpers (used also in exercises.go)
// ------------------------------------------------------------------

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func BadRequest(w http.ResponseWriter, msg string) {
	http.Error(w, msg, http.StatusBadRequest)
}
func NotFound(w http.ResponseWriter) {
	http.Error(w, "not found", http.StatusNotFound)
}
func Forbidden(w http.ResponseWriter) {
	http.Error(w, "forbidden", http.StatusForbidden)
}
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
func ServerError(w http.ResponseWriter, err error) {
	http.Error(w, "server error: "+err.Error(), http.StatusInternalServerError)
}

// small utils
func coalesce(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func normalizeVisibility(v string) string {
	switch strings.ToLower(v) {
	case "public":
		return "public"
	case "unlisted":
		return "unlisted"
	default:
		return "private"
	}
}

func Param(r *http.Request, key string) string {
	return chi.URLParam(r, key)
}

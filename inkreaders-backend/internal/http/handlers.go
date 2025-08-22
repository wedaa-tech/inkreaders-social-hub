package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/bluesky-social/indigo/xrpc"

	// we reference db.Store in Handlers so keep this import
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/types"
)

type Handlers struct {
	agent *xrpc.Client
	did   string
	Store *db.Store
}

func NewHandlers(agent *xrpc.Client, did string, store *db.Store) *Handlers {
	return &Handlers{agent: agent, did: did, Store: store}
}

func (h *Handlers) Healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(200)
	_, _ = w.Write([]byte("ok"))
}

// POST /api/ink/post-book
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

// POST /api/ink/post-article
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

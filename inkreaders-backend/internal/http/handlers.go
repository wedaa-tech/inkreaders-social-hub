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

// ==== LIKE ====
type likeIn struct {
  Uri string `json:"uri"`
  Cid string `json:"cid"`
}

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


// GET /api/ink/my-book-posts
func (h *Handlers) MyBookPosts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// raw XRPC call so custom types decode as generic JSON
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


// GET /api/debug/db-sample
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
	if err != nil { http.Error(w, err.Error(), 500); return }
	defer rows.Close()

	var out []row
	for rows.Next() {
		var rr row
		if err := rows.Scan(&rr.URI, &rr.Collection, &rr.CreatedAt, &rr.BookID); err != nil {
			http.Error(w, err.Error(), 500); return
		}
		out = append(out, rr)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"posts": out})
}


func (h *Handlers) Like(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  var in likeIn
  if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

  body := map[string]any{
    "repo": h.did,
    "collection": "app.bsky.feed.like",
    "record": map[string]any{
      "$type":     "app.bsky.feed.like",
      "createdAt": time.Now().UTC().Format(time.RFC3339),
      "subject": map[string]any{ "uri": in.Uri, "cid": in.Cid },
    },
  }
  var out struct{ URI, CID string }
  if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
    "com.atproto.repo.createRecord", nil, body, &out); err != nil {
    http.Error(w, err.Error(), 500); return
  }
  _ = json.NewEncoder(w).Encode(out)
}


// ==== REPOST ====
func (h *Handlers) Repost(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  var in likeIn
  if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

  body := map[string]any{
    "repo": h.did,
    "collection": "app.bsky.feed.repost",
    "record": map[string]any{
      "$type":     "app.bsky.feed.repost",
      "createdAt": time.Now().UTC().Format(time.RFC3339),
      "subject": map[string]any{ "uri": in.Uri, "cid": in.Cid },
    },
  }
  var out struct{ URI, CID string }
  if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
    "com.atproto.repo.createRecord", nil, body, &out); err != nil {
    http.Error(w, err.Error(), 500); return
  }
  _ = json.NewEncoder(w).Encode(out)
}

// ==== REPLY ====
type replyIn struct {
  ParentUri string `json:"parentUri"`
  ParentCid string `json:"parentCid"`
  Text      string `json:"text"`
}
func (h *Handlers) Reply(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  var in replyIn
  if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

  body := map[string]any{
    "repo": h.did,
    "collection": "app.bsky.feed.post",
    "record": map[string]any{
      "$type":     "app.bsky.feed.post",
      "createdAt": time.Now().UTC().Format(time.RFC3339),
      "text":      in.Text,
      "reply": map[string]any{
        "root": map[string]any{ "uri": in.ParentUri, "cid": in.ParentCid },
        "parent": map[string]any{ "uri": in.ParentUri, "cid": in.ParentCid },
      },
    },
  }
  var out struct{ URI, CID string }
  if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
    "com.atproto.repo.createRecord", nil, body, &out); err != nil {
    http.Error(w, err.Error(), 500); return
  }
  _ = json.NewEncoder(w).Encode(out)
}

// ==== FOLLOW ====
type followIn struct {
  DidOrHandle string `json:"didOrHandle"` // e.g. "did:plc:..." or "alice.bsky.social"
}
func (h *Handlers) Follow(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  var in followIn
  if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

  body := map[string]any{
    "repo": h.did,
    "collection": "app.bsky.graph.follow",
    "record": map[string]any{
      "$type":     "app.bsky.graph.follow",
      "createdAt": time.Now().UTC().Format(time.RFC3339),
      "subject":   in.DidOrHandle,
    },
  }
  var out struct{ URI, CID string }
  if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
    "com.atproto.repo.createRecord", nil, body, &out); err != nil {
    http.Error(w, err.Error(), 500); return
  }
  _ = json.NewEncoder(w).Encode(out)
}

// GET /api/bsky/post-stats?uri=at://...
func (h *Handlers) PostStats(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    uri := r.URL.Query().Get("uri")
    if uri == "" {
        http.Error(w, "uri required", 400)
        return
    }

    params := map[string]any{ "uris": []string{uri} }

    var out struct {
        Posts []struct {
            Uri        string `json:"uri"`
            Cid        string `json:"cid"`
            LikeCount  int    `json:"likeCount"`
            RepostCount int   `json:"repostCount"`
            ReplyCount int    `json:"replyCount"`
        } `json:"posts"`
    }

    if err := h.agent.Do(ctx, xrpc.Query, "", "app.bsky.feed.getPosts", params, nil, &out); err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    if len(out.Posts) == 0 {
        _ = json.NewEncoder(w).Encode(map[string]int{"likes":0,"reposts":0,"replies":0})
        return
    }

    p := out.Posts[0]
    _ = json.NewEncoder(w).Encode(map[string]int{
        "likes":   p.LikeCount,
        "reposts": p.RepostCount,
        "replies": p.ReplyCount,
    })
}

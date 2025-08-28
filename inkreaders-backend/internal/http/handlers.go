package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt" 
	"io"
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

/* ------------------------------------------------------------------------
   Helper: raw XRPC call with custom Bearer + PDS (for per-user actions)
------------------------------------------------------------------------- */
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
        // Return a plain error that includes status + short body
        return fmt.Errorf("xrpc %s failed: status=%d body=%s", method, resp.StatusCode, string(buf))
    }

    if out != nil {
        return json.NewDecoder(resp.Body).Decode(out)
    }
    return nil
}

// POST /api/ink/post-book  (app repo — unchanged)
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

// POST /api/ink/post-article (app repo — unchanged)
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

// GET /api/ink/my-book-posts (app repo — unchanged)
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

// GET /api/debug/db-sample (unchanged)
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

/* ------------------------------------------------------------------------
   Actions below now accept an optional *SessionData (from auth middleware).
   If s != nil → act as the user. Else → fallback to app account (existing).
------------------------------------------------------------------------- */

// SessionData is provided by internal/http/auth.go
// type SessionData struct {
//   AccountID string
//   DID       string
//   Handle    string
//   PDSBase   string
//   AccessJWT string
//   RefreshJWT string
//   ExpiresAt time.Time
// }



// ==== POST (note) ====
// POST /api/bsky/post
type postIn struct {
	Text string `json:"text"`
}

func (h *Handlers) Post(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in postIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", 400); return
	}
	t := in.Text
	if t == "" {
		http.Error(w, "text required", 400); return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	body := map[string]any{
		"repo":       h.did, // default to app account
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      t,
		},
	}

	var out struct{ URI, CID string }

	if s != nil {
		// Post as the logged-in user
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			http.Error(w, err.Error(), 502); return
		}
	} else {
		// Fallback: app account
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out); err != nil {
			http.Error(w, err.Error(), 500); return
		}
	}

	_ = json.NewEncoder(w).Encode(out)
}

// ==== LIKE ====
func (h *Handlers) Like(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in likeIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

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

	// If logged-in → post in user's repo using their token + PDS
	if s != nil {
		body["repo"] = s.DID
		if err := h.doXrpc(ctx, s.PDSBase, s.AccessJWT, "com.atproto.repo.createRecord", body, &out); err != nil {
			http.Error(w, err.Error(), 502); return
		}
	} else {
		// fallback to app account
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out); err != nil {
			http.Error(w, err.Error(), 500); return
		}
	}

	_ = json.NewEncoder(w).Encode(out)
}

// ==== REPOST ====
func (h *Handlers) Repost(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in likeIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

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
			http.Error(w, err.Error(), 502); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out); err != nil {
			http.Error(w, err.Error(), 500); return
		}
	}

	_ = json.NewEncoder(w).Encode(out)
}

// ==== REPLY ====
type replyIn struct {
	ParentUri string `json:"parentUri"`
	ParentCid string `json:"parentCid"`
	Text      string `json:"text"`
}

func (h *Handlers) Reply(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in replyIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

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
			http.Error(w, err.Error(), 502); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out); err != nil {
			http.Error(w, err.Error(), 500); return
		}
	}

	_ = json.NewEncoder(w).Encode(out)
}

// ==== FOLLOW ====
type followIn struct {
	DidOrHandle string `json:"didOrHandle"` // e.g. "did:plc:..." or "alice.bsky.social"
}

func (h *Handlers) Follow(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in followIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil { http.Error(w, "bad json", 400); return }

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
			http.Error(w, err.Error(), 502); return
		}
	} else {
		if err := h.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out); err != nil {
			http.Error(w, err.Error(), 500); return
		}
	}

	_ = json.NewEncoder(w).Encode(out)
}

// GET /api/bsky/post-stats?uri=at://... (unchanged)
func (h *Handlers) PostStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uri := r.URL.Query().Get("uri")
	if uri == "" {
		http.Error(w, "uri required", 400)
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
		http.Error(w, err.Error(), 500)
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

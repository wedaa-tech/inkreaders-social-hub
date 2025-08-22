package indexer

import (
	"context"
	"log"
	"time"
	"encoding/json"

	"github.com/bluesky-social/indigo/xrpc"
	lexutil "github.com/bluesky-social/indigo/lex/util"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type Indexer struct {
	Agent *xrpc.Client
	DID   string
	DB    *db.Store
}

func New(agent *xrpc.Client, did string, store *db.Store) *Indexer {
	return &Indexer{Agent: agent, DID: did, DB: store}
}

// Poll your own repo for latest book posts
func (ix *Indexer) PollBookPosts(ctx context.Context, pageSize int) error {
	cursor, _ := ix.DB.GetCursor(ctx, "poll:book")

	for {
		out, err := listRecordsRaw(ctx, ix.Agent, ix.DID, "com.inkreaders.book.post", cursor, int64(pageSize), false)
		if err != nil {
			return err
		}
		if len(out.Records) == 0 {
			return nil
		}

		for _, rec := range out.Records {
			uri := rec.Uri
			cid := rec.Cid
			did := ix.DID

			val := rec.Value

			createdAt, _ := time.Parse(time.RFC3339, get(val, "createdAt"))
			text := get(val, "text")
			bookTitle := get(val, "book.title")
			authors := getStringSlice(val, "book.authors")
			isbn10 := get(val, "book.isbn10")
			isbn13 := get(val, "book.isbn13")
			link := get(val, "book.link")

			var bookID *int64
			if bookTitle != "" {
				id, err := ix.DB.UpsertBook(ctx, bookTitle, authors, isbn10, isbn13, link)
				if err != nil {
					log.Println("UpsertBook:", err)
				} else {
					bookID = &id
				}
			}

			var ratingPtr, progressPtr *float64
			if v, ok := getFloat(val, "rating"); ok { ratingPtr = &v }
			if v, ok := getFloat(val, "progress"); ok { progressPtr = &v }

			if err := ix.DB.UpsertBookPost(ctx, uri, cid, did, createdAt, text, bookID, ratingPtr, progressPtr); err != nil {
				log.Println("UpsertBookPost:", err)
			}
		}

		if out.Cursor != nil {
			cursor = *out.Cursor
			if err := ix.DB.SetCursor(ctx, "poll:book", cursor); err != nil {
				log.Println("SetCursor book:", err)
			}
		} else {
			return nil
		}
	}
}



// Poll your own repo for latest article posts
func (ix *Indexer) PollArticlePosts(ctx context.Context, pageSize int) error {
	cursor, _ := ix.DB.GetCursor(ctx, "poll:article")

	for {
		out, err := listRecordsRaw(ctx, ix.Agent, ix.DID, "com.inkreaders.article.post", cursor, int64(pageSize), false)
		if err != nil {
			return err
		}
		if len(out.Records) == 0 {
			return nil
		}

		for _, rec := range out.Records {
			uri := rec.Uri
			cid := rec.Cid
			did := ix.DID

			val := rec.Value

			createdAt, _ := time.Parse(time.RFC3339, get(val, "createdAt"))
			text := get(val, "text")
			title := get(val, "article.title")
			url := get(val, "article.url")
			source := get(val, "article.source")

			if err := ix.DB.UpsertArticlePost(ctx, uri, cid, did, createdAt, text, url, title, source); err != nil {
				log.Println("UpsertArticlePost:", err)
			}
		}

		if out.Cursor != nil {
			cursor = *out.Cursor
			if err := ix.DB.SetCursor(ctx, "poll:article", cursor); err != nil {
				log.Println("SetCursor article:", err)
			}
		} else {
			return nil
		}
	}
}


// helpers to extract nested fields from map[string]any (decoded JSON)
func get(m map[string]any, path string) string {
	cur := any(m)
	for _, part := range split(path) {
		obj, ok := cur.(map[string]any)
		if !ok { return "" }
		cur = obj[part]
	}
	if s, ok := cur.(string); ok { return s }
	return ""
}

func getFloat(m map[string]any, path string) (float64, bool) {
	cur := any(m)
	for _, part := range split(path) {
		obj, ok := cur.(map[string]any)
		if !ok { return 0, false }
		cur = obj[part]
	}
	switch v := cur.(type) {
	case float64: return v, true
	case int64: return float64(v), true
	case int: return float64(v), true
	default: return 0, false
	}
}

func getStringSlice(m map[string]any, path string) []string {
	cur := any(m)
	for _, part := range split(path) {
		obj, ok := cur.(map[string]any)
		if !ok { return nil }
		cur = obj[part]
	}
	arr, ok := cur.([]any)
	if !ok { return nil }
	var out []string
	for _, a := range arr {
		if s, ok := a.(string); ok { out = append(out, s) }
	}
	return out
}

func split(p string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(p); i++ {
		if p[i] == '.' {
			parts = append(parts, p[start:i])
			start = i+1
		}
	}
	parts = append(parts, p[start:])
	return parts
}

// decode rec.Value (LexiconTypeDecoder) into a map[string]any
func decodeToMap(dec *lexutil.LexiconTypeDecoder) (map[string]any, error) {
    // LexiconTypeDecoder implements json.Marshaler/Unmarshaler
    b, err := json.Marshal(dec)
    if err != nil {
        return nil, err
    }
    var m map[string]any
    if err := json.Unmarshal(b, &m); err != nil {
        return nil, err
    }
    return m, nil
}

// listRecordsRaw performs com.atproto.repo.listRecords without lexicon decoding.
// It returns generic maps so we can read custom collections safely.
func listRecordsRaw(ctx context.Context, client *xrpc.Client, repo, collection, cursor string, limit int64, reverse bool) (struct {
	Records []struct {
		Uri   string                 `json:"uri"`
		Cid   string                 `json:"cid"`
		Value map[string]any         `json:"value"`
	} `json:"records"`
	Cursor *string `json:"cursor"`
}, error) {
	params := map[string]any{
		"repo":       repo,
		"collection": collection,
		"limit":      limit,
		"reverse":    reverse,
	}
	if cursor != "" {
		params["cursor"] = cursor
	}
	var out struct {
		Records []struct {
			Uri   string                 `json:"uri"`
			Cid   string                 `json:"cid"`
			Value map[string]any         `json:"value"`
		} `json:"records"`
		Cursor *string `json:"cursor"`
	}
	// Query (GET) call; no request body.
	if err := client.Do(ctx, xrpc.Query, "", "com.atproto.repo.listRecords", params, nil, &out); err != nil {
		return out, err
	}
	return out, nil
}
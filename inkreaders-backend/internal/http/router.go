// internal/http/router.go
package http

import (
	"encoding/json"
	"net/http"

	"github.com/bluesky-social/indigo/xrpc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

func NewRouter(agent *xrpc.Client, did string, store *db.Store) *chi.Mux {
	r := chi.NewRouter()

	// CORS for your Next.js app
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	h := NewHandlers(agent, did, store)

	// Root index
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"service": "inkreaders-backend",
			"status":  "ok",
			"endpoints": []string{
				"GET  /healthz",
				"POST /api/ink/post-book",
				"POST /api/ink/post-article",
				"GET  /api/discovery/trending-books?limit=10",
			},
		})
	})

	// API routes
	r.Post("/api/ink/post-book", h.PostBook)
	r.Post("/api/ink/post-article", h.PostArticle)
	r.Get("/api/discovery/trending-books", h.TrendingBooks)
	r.Get("/healthz", h.Healthz)
	r.Get("/api/ink/my-book-posts", h.MyBookPosts)
	r.Get("/api/debug/db-sample", h.DbSample)
	r.Post("/api/bsky/like", h.Like)
	r.Post("/api/bsky/repost", h.Repost)
	r.Post("/api/bsky/reply", h.Reply)
	r.Post("/api/bsky/follow", h.Follow)
	r.Get("/api/bsky/post-stats", h.PostStats)



	return r
}

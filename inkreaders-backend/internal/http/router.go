// internal/http/router.go
package http

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/bluesky-social/indigo/xrpc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/crypto"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

func NewRouter(agent *xrpc.Client, did string, store *db.Store) *chi.Mux {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	h := NewHandlers(agent, did, store)

	// --- Auth bootstrap ---
	box, err := crypto.NewSecretBox(os.Getenv("APP_ENC_KEY"))
	if err != nil {
		panic("APP_ENC_KEY invalid: " + err.Error())
	}
	pdsDefault := os.Getenv("PDS_DEFAULT")
	if pdsDefault == "" { pdsDefault = "https://bsky.social" }
	auth := NewAuth(store, box, pdsDefault)

	// Root
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"service": "inkreaders-backend",
			"status":  "ok",
		})
	})

	// --- Auth routes ---
	r.Post("/api/auth/login", auth.Login)
	r.Post("/api/auth/logout", auth.Logout)
	r.Get("/api/auth/me", auth.Me) // requires cookie; returns 401 if not logged in

	// --- Existing API routes ---
	r.Post("/api/ink/post-book", h.PostBook)
	r.Post("/api/ink/post-article", h.PostArticle)
	r.Get("/api/discovery/trending-books", h.TrendingBooks)
	r.Get("/healthz", h.Healthz)
	r.Get("/api/ink/my-book-posts", h.MyBookPosts)
	r.Get("/api/debug/db-sample", h.DbSample)

	// Actions that should use user session if available
	r.Post("/api/bsky/like",    auth.WithSessionOptional(h.Like))
	r.Post("/api/bsky/repost",  auth.WithSessionOptional(h.Repost))
	r.Post("/api/bsky/reply",   auth.WithSessionOptional(h.Reply))
	r.Post("/api/bsky/follow",  auth.WithSessionOptional(h.Follow))
	r.Post("/api/bsky/post",    auth.WithSessionOptional(h.Post))
	r.Get("/api/bsky/post-stats", h.PostStats)

	return r
}

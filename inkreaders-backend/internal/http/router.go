package http

import (
	"github.com/bluesky-social/indigo/xrpc"
	"github.com/go-chi/chi/v5"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

func NewRouter(agent *xrpc.Client, did string, store *db.Store) *chi.Mux {
	r := chi.NewRouter()
	h := NewHandlers(agent, did, store)

	r.Post("/api/ink/post-book", h.PostBook)
	r.Post("/api/ink/post-article", h.PostArticle)
	r.Get("/api/discovery/trending-books", h.TrendingBooks)
	r.Get("/healthz", h.Healthz)

	return r
}

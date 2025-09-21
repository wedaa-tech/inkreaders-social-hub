// internal/http/router.go
package http

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/bluesky-social/indigo/xrpc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/crypto"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

func NewRouter(agent *xrpc.Client, did string, store *db.Store, aiClient ai.Client, pub Publisher, storage Storage, extract Extractor) *chi.Mux {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Build handlers
	h := NewHandlers(agent, did, store, aiClient, pub, storage, extract)

	// --- Auth bootstrap ---
	box, err := crypto.NewSecretBox(os.Getenv("APP_ENC_KEY"))
	if err != nil {
		panic("APP_ENC_KEY invalid: " + err.Error())
	}
	pdsDefault := os.Getenv("PDS_DEFAULT")
	if pdsDefault == "" {
		pdsDefault = "https://bsky.social"
	}
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
	r.Get("/api/auth/me", auth.Me)

	// --- InkReaders custom posts ---
	r.Post("/api/ink/post-book", h.PostBook)
	r.Post("/api/ink/post-article", h.PostArticle)
	// 🚨 Removed h.TrendingBooks (was missing in handlers.go)
	r.Get("/healthz", h.Healthz)
	r.Get("/api/ink/my-book-posts", h.MyBookPosts)
	r.Get("/api/debug/db-sample", h.DbSample)

	// --- Engagement & timeline ---
	r.Post("/api/bsky/like", auth.WithSessionOptional(h.Like))
	r.Post("/api/bsky/repost", auth.WithSessionOptional(h.Repost))
	r.Post("/api/bsky/reply", auth.WithSessionOptional(h.Reply))
	r.Post("/api/bsky/follow", auth.WithSessionOptional(h.Follow))
	r.Post("/api/bsky/post", auth.WithSessionOptional(h.Post))
	r.Get("/api/bsky/post-stats", h.PostStats)
	r.Get("/api/bsky/timeline", auth.WithSessionOptional(h.Timeline))
	r.Get("/api/debug/who", auth.WithSessionOptional(h.Who))

	// --- Profile & Prefs ---
	r.Get("/api/profile", auth.WithSession(h.ProfileGet))
	r.Put("/api/profile", auth.WithSession(h.ProfileUpdate))
	r.Get("/api/prefs", auth.WithSession(h.PrefsGet))
	r.Put("/api/prefs", auth.WithSession(h.PrefsUpdate))
	r.Post("/api/profile/sync-from-remote", auth.WithSession(h.ProfileSyncFromRemote))

	// --- Exercises ---
	r.Post("/api/exercises/generate", auth.WithSessionOptional(h.ExercisesGenerate))
	// AI explanation for a single question (non-persistent). Session optional.
	r.Post("/api/exercises/explain", auth.WithSessionOptional(h.ExercisesExplain))
	r.Post("/api/exercises/save", auth.WithSession(h.ExercisesSave))
	r.Get("/api/exercises/mine", auth.WithSession(h.ExercisesMine))
	r.Get("/api/exercises/{id}", auth.WithSession(h.ExercisesGet))
	r.Patch("/api/exercises/{id}", auth.WithSession(h.ExercisesUpdate))
	r.Post("/api/exercises/{id}/publish", auth.WithSession(h.ExercisesPublish))
	r.Post("/api/exercises/{id}/remix", auth.WithSession(h.ExercisesRemix))
	r.Post("/api/exercises/uploads", auth.WithSession(h.ExercisesUpload))


	// --- Notebook (Topics) ---
	r.Get("/api/topics", auth.WithSession(h.ListTopics))
	r.Post("/api/topics", auth.WithSession(h.CreateTopic))
	r.Get("/api/topics/{id}", auth.WithSession(h.GetTopic))
	r.Patch("/api/topics/{id}", auth.WithSession(h.UpdateTopic))

	// Responses
	r.Get("/api/topics/{topic_id}/responses", auth.WithSessionOptional(h.ListResponses))
	r.Post("/api/topics/{topic_id}/responses", auth.WithSession(h.CreateResponse))
	r.Get("/api/responses/{id}", auth.WithSessionOptional(h.GetResponse))
	r.Patch("/api/responses/{id}", auth.WithSession(h.UpdateResponse))

	// Responses version
	r.Route("/api/responses", func(r chi.Router) {
    r.Get("/{id}/versions", auth.WithSession(h.ListResponseVersions))
    r.Get("/versions/{version_id}", auth.WithSession(h.GetResponseVersion))
	})

	// Highlights
	r.Get("/api/topics/{topic_id}/highlights", auth.WithSession(h.ListHighlights))
	r.Post("/api/topics/{topic_id}/highlights", auth.WithSession(h.CreateHighlight))
	r.Patch("/api/highlights/{id}", auth.WithSession(h.UpdateHighlight))
	r.Delete("/api/highlights/{id}", auth.WithSession(h.DeleteHighlight))


	return r
}

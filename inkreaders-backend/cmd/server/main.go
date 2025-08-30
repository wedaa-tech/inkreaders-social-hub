package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/bootstrap"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	httph "github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/http"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// 🔑 Login with app account
	agent, did := bootstrap.NewAppAgent(cfg)

	ctx := context.Background()
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		log.Fatal("DB_DSN required")
	}
	store, err := db.Open(ctx, dsn)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer store.Close()

	// --- Deps (stubs for now) ---
	aiClient := ai.NewStub()
	pub := httph.NoopPublisher{}
	storage := httph.NewLocalStorage("./data/uploads")
	extract := httph.NewExtractor()

	// Build router
	r := httph.NewRouter(agent, did, store, aiClient, pub, storage, extract)

	log.Printf("Logged in as DID=%s Handle=%s", did, cfg.Handle)
	log.Printf("DB_DSN=%s", os.Getenv("DB_DSN"))
	log.Printf("server listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}

// cmd/server/main.go
package main

import (
	"context"           // ✅ add
	"log"
	"net/http"
	"os"                // ✅ add

	"github.com/joho/godotenv"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/atproto"
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

	agent, did, err := atproto.NewAgent(cfg)
	if err != nil {
		log.Fatalf("atproto login: %v", err)
	}

	// DB
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

	// Router (note: NewRouter now needs store)
	r := httph.NewRouter(agent, did, store)

	log.Printf("server listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}

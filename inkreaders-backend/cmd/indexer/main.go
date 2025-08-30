package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/bootstrap"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/indexer"
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
	store, err := db.Open(ctx, getenv("DB_DSN"))
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer store.Close()

	ix := indexer.New(agent, did, store)

	log.Printf("Logged in as DID=%s Handle=%s", did, cfg.Handle)
	log.Printf("DB_DSN=%s", os.Getenv("DB_DSN"))
	log.Println("mini indexer: polling every 20s (books & articles)")

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	// initial poll
	if err := ix.PollBookPosts(ctx, 50); err != nil {
		log.Println("poll book:", err)
	}
	if err := ix.PollArticlePosts(ctx, 50); err != nil {
		log.Println("poll article:", err)
	}

	for range ticker.C {
		if err := ix.PollBookPosts(ctx, 50); err != nil {
			log.Println("poll book:", err)
		}
		if err := ix.PollArticlePosts(ctx, 50); err != nil {
			log.Println("poll article:", err)
		}
	}
}

func getenv(k string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	log.Fatalf("%s required", k)
	return ""
}

// cmd/register-lexicon/main.go
package main

import (
	"context"
	"log"
	"os"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/joho/godotenv"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
	ink_atproto "github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/atproto"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	agent, _, err := ink_atproto.NewAgent(cfg)
	if err != nil {
		log.Fatalf("login failed: %v", err)
	}

	lexPath := "./lexicons/com.inkreaders.exercise.post.json"
	data, err := os.ReadFile(lexPath)
	if err != nil {
		log.Fatalf("read lexicon: %v", err)
	}

	_, err = atproto.AdminPutSchema(context.Background(), agent, &atproto.AdminPutSchema_Input{
		Schema: string(data),
	})
	if err != nil {
		log.Fatalf("register lexicon: %v", err)
	}

	log.Printf("✅ Registered lexicon from %s", lexPath)
}

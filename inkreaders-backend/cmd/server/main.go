package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	httph "github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/http"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/atproto"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// --- ATProto agent login (App account) ---
	agent, did, err := atproto.NewAgent(cfg)
	if err != nil {
		log.Fatalf("atproto login: %v", err)
	}
	log.Printf("App account AccessJwt: %s", agent.Auth.AccessJwt)

	// --- Database ---
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

	// --- AI Client (switchable via env) ---
	var aiClient ai.Client
	if os.Getenv("AI_STUB") == "true" {
		log.Println("[AI] Using Stub generator")
		aiClient = ai.NewStub()
	} else {
		model := os.Getenv("OPENAI_MODEL")
		if model == "" {
			model = "gpt-4o-mini" // safe default
		}
		apiKey := os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			log.Fatal("OPENAI_API_KEY required (or set AI_STUB=true)")
		}
		log.Printf("[AI] Using OpenAI model=%s", model)
		aiClient = ai.NewOpenAI(model, apiKey)
	}

	// --- Other deps ---
	pub := httph.NewAtprotoPublisher(agent, did)           // real publisher
	storage := httph.NewLocalStorage("./data/uploads")     // local disk storage
	extract := httph.NewExtractor()                        // stub extractor for PDF/text

	// --- Router ---
	r := httph.NewRouter(agent, did, store, aiClient, pub, storage, extract)

	log.Printf("Logged in as DID=%s Handle=%s", did, cfg.Handle)
	log.Printf("DB_DSN=%s", os.Getenv("DB_DSN"))
	log.Printf("server listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}

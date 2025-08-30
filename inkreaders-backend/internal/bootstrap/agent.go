package bootstrap

import (
	"context"
	"log"
	"time"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/xrpc"

	myatproto "github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/atproto" // alias
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
)

// NewAppAgent logs in with the configured app account
// and runs a background refresh loop.
func NewAppAgent(cfg *config.Config) (*xrpc.Client, string) {
	agent, did, err := myatproto.NewAgent(cfg)
	if err != nil {
		log.Fatalf("app account login failed: %v", err)
	}

	// Background refresh loop
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			ctx := context.Background()
			resp, err := atproto.ServerRefreshSession(ctx, agent)
			if err != nil {
				log.Printf("⚠️ app account refresh failed: %v", err)
				continue
			}

			agent.Auth = &xrpc.AuthInfo{
				AccessJwt:  resp.AccessJwt,
				RefreshJwt: resp.RefreshJwt,
				Handle:     resp.Handle,
				Did:        resp.Did,
			}

			log.Printf("✅ app account refreshed: DID=%s handle=%s", resp.Did, resp.Handle)
		}
	}()

	return agent, did
}

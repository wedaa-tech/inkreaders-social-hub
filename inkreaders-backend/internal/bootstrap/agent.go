package bootstrap

import (
	"log"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/atproto"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
	"github.com/bluesky-social/indigo/xrpc"
)

// NewAppAgent logs in with the configured app account
// and returns a ready-to-use authenticated xrpc.Client + DID.
func NewAppAgent(cfg *config.Config) (*xrpc.Client, string) {
	agent, did, err := atproto.NewAgent(cfg)
	if err != nil {
		log.Fatalf("app account login failed: %v", err)
	}
	return agent, did
}

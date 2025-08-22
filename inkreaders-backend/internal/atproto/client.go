package atproto

import (
	"context"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/xrpc"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/config"
)

func NewAgent(cfg *config.Config) (*xrpc.Client, string, error) {
	ctx := context.Background()
	cli := &xrpc.Client{Host: cfg.Service}

	out, err := atproto.ServerCreateSession(ctx, cli, &atproto.ServerCreateSession_Input{
		Identifier: cfg.Handle,
		Password:   cfg.Pass,
	})
	if err != nil {
		return nil, "", err
	}

	cli.Auth = &xrpc.AuthInfo{
		AccessJwt:  out.AccessJwt,
		RefreshJwt: out.RefreshJwt,
		Handle:     out.Handle,
		Did:        out.Did,
	}
	return cli, out.Did, nil
}

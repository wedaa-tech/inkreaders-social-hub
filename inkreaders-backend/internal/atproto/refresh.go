package atproto

import (
	"context"

	"github.com/bluesky-social/indigo/api/atproto"
	"github.com/bluesky-social/indigo/xrpc"
)

// ServerRefreshSession refreshes the current app account session.
func ServerRefreshSession(ctx context.Context, cli *xrpc.Client) (*atproto.ServerRefreshSession_Output, error) {
	return atproto.ServerRefreshSession(ctx, cli)
}

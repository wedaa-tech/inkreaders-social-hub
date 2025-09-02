package http

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/bluesky-social/indigo/xrpc"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type AtprotoPublisher struct {
	agent  *xrpc.Client
	appDID string
}

func NewAtprotoPublisher(agent *xrpc.Client, did string) *AtprotoPublisher {
	return &AtprotoPublisher{agent: agent, appDID: did}
}

func (p *AtprotoPublisher) PublishExerciseSet(ctx context.Context, s *SessionData, set db.ExerciseSet, allowRemix bool) (uri, cid string, err error) {
	now := time.Now().UTC().Format(time.RFC3339)

	body := map[string]any{
		"repo":       repoFor(s, p.appDID),
		"collection": "com.inkreaders.exercise.post",
		"record": map[string]any{
			"$type":     "com.inkreaders.exercise.post",
			"createdAt": now,
			"title":     set.Title,
			"format":    set.Format,
			"questions": set.Questions,
			"meta":      set.Meta,
			"allowRemix": allowRemix,
		},
	}

	// --- DEBUG LOGGING ---
	b, _ := json.MarshalIndent(body, "", "  ")
	log.Printf("[DEBUG] PublishExerciseSet payload:\n%s", string(b))
	// ---------------------

	var out struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}

	if s != nil {
		// publish as user
		err = doXrpcAuth(ctx, s, "com.atproto.repo.createRecord", body, &out)
	} else {
		// fallback to app account
		err = p.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out)
	}
	if err != nil {
		return "", "", err
	}
	return out.URI, out.CID, nil
}

func (p *AtprotoPublisher) CreateExercisePost(
    ctx context.Context,
    s *SessionData,
    exerciseURI, exerciseCID, title string,
    previewCount int,
) error {
    now := time.Now().UTC().Format(time.RFC3339)
    body := map[string]any{
        "repo":       repoFor(s, p.appDID),
        "collection": "app.bsky.feed.post",
        "record": map[string]any{
            "$type":     "app.bsky.feed.post",
            "createdAt": now,
            "text":      "📘 New Exercise: " + title,
            "embed": map[string]any{
                "$type": "app.bsky.embed.record",
                "record": map[string]any{
                    "uri": exerciseURI,
                    "cid": exerciseCID, // ✅ required
                },
            },
        },
    }

    // --- DEBUG LOGGING ---
    b, _ := json.MarshalIndent(body, "", "  ")
    log.Printf("[DEBUG] CreateExercisePost payload:\n%s", string(b))
    // ---------------------

    var out struct {
        URI string `json:"uri"`
        CID string `json:"cid"`
    }

    var err error
    if s != nil {
        err = doXrpcAuth(ctx, s, "com.atproto.repo.createRecord", body, &out)
    } else {
        err = p.agent.Do(ctx, xrpc.Procedure, "application/json",
            "com.atproto.repo.createRecord", nil, body, &out)
    }

    if err != nil {
        return err
    }

    log.Printf("[DEBUG] Feed post created: %s (cid=%s)", out.URI, out.CID)
    return nil
}


// helper: choose repo DID
func repoFor(s *SessionData, appDID string) string {
	if s != nil {
		return s.DID
	}
	return appDID
}

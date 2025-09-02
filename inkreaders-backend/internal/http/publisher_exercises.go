package http

import (
	"context"
	"encoding/json"
	"fmt"
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

// PublishExerciseSet → creates BOTH:
//   1) custom record (com.inkreaders.exercise.post)
//   2) standard feed post (app.bsky.feed.post)
// Returns: exerciseURI, exerciseCID, feedURI, error
// internal/http/publisher_exercises.go
func (p *AtprotoPublisher) PublishExerciseSet(
	ctx context.Context,
	s *SessionData,
	set db.ExerciseSet,
	allowRemix bool,
) (uri, cid, feedURI string, err error) {
	now := time.Now().UTC().Format(time.RFC3339)

	// --- Step 1: Publish custom record (opaque on Bluesky, used by Inkreaders) ---
	customBody := map[string]any{
		"repo":       repoFor(s, p.appDID),
		"collection": "com.inkreaders.exercise.post",
		"record": map[string]any{
			"$type":      "com.inkreaders.exercise.post",
			"createdAt":  now,
			"title":      set.Title,
			"format":     set.Format,
			"questions":  set.Questions,
			"meta":       set.Meta,
			"allowRemix": allowRemix,
		},
	}

	var customOut struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}
	if s != nil {
		err = doXrpcAuth(ctx, s, "com.atproto.repo.createRecord", customBody, &customOut)
	} else {
		err = p.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, customBody, &customOut)
	}
	if err != nil {
		return "", "", "", err
	}

	// --- Step 2: Publish standard Bluesky feed post (teaser + link only) ---
	previewURL := fmt.Sprintf("https://inkreaders.app/exercises/%s/preview", set.ID)

	feedText := fmt.Sprintf("📘 New Exercise: %s\nTry it here 👉 %s", set.Title, previewURL)

	feedBody := map[string]any{
		"repo":       repoFor(s, p.appDID),
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      feedText,
		},
	}

	var feedOut struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}
	if s != nil {
		err = doXrpcAuth(ctx, s, "com.atproto.repo.createRecord", feedBody, &feedOut)
	} else {
		err = p.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, feedBody, &feedOut)
	}
	if err != nil {
		return customOut.URI, customOut.CID, "", err
	}

	log.Printf("[DEBUG] Custom record published: %s (cid=%s)", customOut.URI, customOut.CID)
	log.Printf("[DEBUG] Feed post created: %s (cid=%s)", feedOut.URI, feedOut.CID)

	return customOut.URI, customOut.CID, feedOut.URI, nil
}


// CreateExercisePost is now just a thin wrapper if you want *only* a feed post
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

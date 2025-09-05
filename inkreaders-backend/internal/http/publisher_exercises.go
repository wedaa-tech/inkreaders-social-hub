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
//   2) standard feed post (app.bsky.feed.post, with facets & full review link)
func (p *AtprotoPublisher) PublishExerciseSet(
	ctx context.Context,
	s *SessionData,
	set db.ExerciseSet,
	allowRemix bool,
) (uri, cid, feedURI string, err error) {
	now := time.Now().UTC().Format(time.RFC3339)

	// --- Step 1: Custom record ---
	body := map[string]any{
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

	var out struct {
		URI string `json:"uri"`
		CID string `json:"cid"`
	}
	if s != nil {
		err = doXrpcAuth(ctx, s, "com.atproto.repo.createRecord", body, &out)
	} else {
		err = p.agent.Do(ctx, xrpc.Procedure, "application/json",
			"com.atproto.repo.createRecord", nil, body, &out)
	}
	if err != nil {
		return "", "", "", err
	}

	// --- Step 2: Feed post (clean text + clickable review link) ---
	link := fmt.Sprintf("https://inkreaders.app/exercises/%s/preview", set.ID)

	feedText := fmt.Sprintf("📘 New Exercise: %s", set.Title)
	if len(set.Questions) > 0 {
		firstQ := set.Questions[0].Prompt
		if len(firstQ) > 80 {
			firstQ = firstQ[:77] + "..."
		}
		feedText += "\nQ1: " + firstQ
	}
	feedText += "\n\nSee full: " + link

	// Add facet for link
	start := len(feedText) - len(link)
	end := len(feedText)
	facets := []map[string]any{
		{
			"index": map[string]any{
				"byteStart": start,
				"byteEnd":   end,
			},
			"features": []map[string]any{
				{
					"$type": "app.bsky.richtext.facet#link",
					"uri":   link,
				},
			},
		},
	}

	feedBody := map[string]any{
		"repo":       repoFor(s, p.appDID),
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      feedText,
			"facets":    facets,
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
		return out.URI, out.CID, "", err
	}

	log.Printf("[DEBUG] Custom record published: %s (cid=%s)", out.URI, out.CID)
	log.Printf("[DEBUG] Feed post created: %s (cid=%s)", feedOut.URI, feedOut.CID)

	return out.URI, out.CID, feedOut.URI, nil
}

// Legacy method (still here if needed elsewhere)
func (p *AtprotoPublisher) CreateExercisePost(
	ctx context.Context,
	s *SessionData,
	exerciseURI, exerciseCID, title string,
	previewCount int,
) error {
	now := time.Now().UTC().Format(time.RFC3339)
	link := fmt.Sprintf("https://inkreaders.app/exercises/%s/preview", exerciseURI)

	body := map[string]any{
		"repo":       repoFor(s, p.appDID),
		"collection": "app.bsky.feed.post",
		"record": map[string]any{
			"$type":     "app.bsky.feed.post",
			"createdAt": now,
			"text":      "📘 New Exercise: " + title + "\n\nSee full: " + link,
		},
	}

	// Debug
	b, _ := json.MarshalIndent(body, "", "  ")
	log.Printf("[DEBUG] CreateExercisePost payload:\n%s", string(b))

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

package http

import (
    "context"
    "github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type NoopPublisher struct{}

func (NoopPublisher) PublishExerciseSet(ctx context.Context, s *SessionData, set db.ExerciseSet, allowRemix bool) (string, string, error) {
    return "", "", nil
}

func (NoopPublisher) CreateExercisePost(ctx context.Context, s *SessionData, exerciseURI, title string, previewCount int) error {
    return nil
}

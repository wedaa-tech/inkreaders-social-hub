package ai

import (
	"context"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type GenerateParams struct {
	Title      string
	Topic      string
	Formats    []string
	Count      int
	Language   string
	Difficulty string
	SourceText string // optional
}

type GenerateOut struct {
	InferredTitle  string
	InferredFormat string
	Questions      []db.Question
}

type Client interface {
	Generate(ctx context.Context, p GenerateParams) (GenerateOut, error)
	Remix(ctx context.Context, p RemixParams) (db.ExerciseSet, error)
	Explain(ctx context.Context, questionID string, prompt string, answer any) (string, error)
	GenerateResponse(ctx context.Context, prompt string) (string, error)
}

type RemixParams struct {
	Parent    db.ExerciseSet
	Transform string
	Harder    bool
	ReduceTo  int
	Note      string
}



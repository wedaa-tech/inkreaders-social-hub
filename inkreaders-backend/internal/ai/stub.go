package ai

import (
	"context"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type Stub struct{}

func NewStub() *Stub { return &Stub{} }

func (s *Stub) Generate(ctx context.Context, p GenerateParams) (GenerateOut, error) {
	return GenerateOut{
		InferredTitle:  ifEmpty(p.Title, "Exercise Set"),
		InferredFormat: "mcq",
		Questions: []db.Question{
			{Type: "mcq", Q: "Stub question?", Options: []string{"A","B"}, Answer: "A"},
		},
	}, nil
}

func (s *Stub) Remix(ctx context.Context, p RemixParams) (db.ExerciseSet, error) {
	return db.ExerciseSet{
		Title:     p.Parent.Title + " (Remix)",
		Format:    p.Parent.Format,
		Questions: p.Parent.Questions,
		Meta: db.ExerciseMeta{
			Difficulty: p.Parent.Meta.Difficulty,
			Language:   p.Parent.Meta.Language,
			Source:     db.ExerciseSource{Type: "remix"},
		},
		Visibility: "private",
	}, nil
}

func ifEmpty(s, def string) string {
	if s == "" { return def }
	return s
}

package ai

import (
	"context"
	"fmt"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type Stub struct{}

func NewStub() *Stub { return &Stub{} }

func (s *Stub) Generate(ctx context.Context, p GenerateParams) (GenerateOut, error) {
	return GenerateOut{
		InferredTitle:  ifEmpty(p.Title, "Exercise Set"),
		InferredFormat: "mcq",
		Questions: []db.Question{
			{
				Type:          "mcq",
				Prompt:        "Stub question?",
				Options:       []string{"A", "B"},
				CorrectAnswer: "A",
				Explanation:   "Because A.",
			},
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

func (s *Stub) Explain(ctx context.Context, questionID string, prompt string, answer any) (string, error) {
	ansStr := fmt.Sprintf("%v", answer)
	if ansStr == "<nil>" {
		ansStr = ""
	}
	if ansStr == "" {
		return "This is a stub explanation: the correct answer is provided above. In production, the AI will return a concise rationale.", nil
	}
	return fmt.Sprintf("Stub explanation for %s: The answer is %s. (In production the AI will provide a concise rationale.)", questionID, ansStr), nil
}

// GenerateResponse returns a canned AI response for Notebook (stub mode).
func (s *Stub) GenerateResponse(ctx context.Context, prompt string) (string, error) {
	return fmt.Sprintf("📒 Stub AI response for: %s\n\nThis is a placeholder response. In production, the AI will generate a complete answer.", prompt), nil
}

func ifEmpty(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

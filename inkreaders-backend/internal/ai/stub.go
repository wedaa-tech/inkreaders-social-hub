package ai

import (
	"context"
	"fmt"
	"strings"

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

// Explain returns a canned explanation (used when AI_STUB=true).
func (s *Stub) Explain(ctx context.Context, questionID string, prompt string, answer any) (string, error) {
	ansStr := fmt.Sprintf("%v", answer)
	if ansStr == "<nil>" {
		ansStr = ""
	}

	// Simple language mirroring stub:
	if containsHindi(prompt) {
		return "यह एक स्टब उत्तर है। वास्तविक AI हिंदी में सारांश और व्याख्या देगा।", nil
	}
	if containsTelugu(prompt) {
		return "ఇది ఒక స్టబ్ సమాధానం. నిజమైన AI తెలుగు లో సమాధానం ఇస్తుంది.", nil
	}
	if containsBangla(prompt) {
		return "এটি একটি স্টাব উত্তর। প্রকৃত AI বাংলা ভাষায় উত্তর দেবে।", nil
	}

	// Default English
	return fmt.Sprintf("Stub explanation for %s: The answer is %s.", questionID, ansStr), nil
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


func containsHindi(s string) bool {
	return strings.ContainsAny(s, "अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह") // Devanagari range
}

func containsTelugu(s string) bool {
	return strings.ContainsAny(s, "అఆఇఈఉఊఎఏఐఒఓఔకఖగఘఙచఛజఝఞటఠడఢణతథదధనపఫబభమయరలవశషసహ") // Telugu
}

func containsBangla(s string) bool {
	return strings.ContainsAny(s, "অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ") // Bengali
}

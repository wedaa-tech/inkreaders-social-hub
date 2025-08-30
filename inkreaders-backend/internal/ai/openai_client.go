package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"io" 
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
	"net/http"
	"bytes"
)

type OpenAIClient struct {
	Model string
	APIKey string
	HTTP *http.Client
}

func NewOpenAI(model string, apiKey string) *OpenAIClient {
	return &OpenAIClient{
		Model: model,
		APIKey: apiKey,
		HTTP: http.DefaultClient,
	}
}

var sysPrompt = `You are an exercise generator.
Output STRICT UTF-8 JSON ONLY (no markdown, no comments, no prose).
Each item must follow this shape:
[
  {
    "type": "mcq" | "fill_blank" | "true_false",
    "q": "Question text",
    "options": ["A","B","C","D"],        // mcq only
    "answer": "A" | "B" | "C" | "D" | true | false | "word",
    "explain": "short rationale"
  }
]`

func (c *OpenAIClient) Generate(ctx context.Context, p GenerateParams) (GenerateOut, error) {
	userPrompt := builderPrompt(p)

	raw, err := c.chat(ctx, sysPrompt, userPrompt)
	if err != nil {
		return GenerateOut{}, err
	}

	// 1) Parse JSON
	var items []db.Question
	if err := json.Unmarshal(raw, &items); err != nil {
		// Sometimes models add stray characters; try to trim to first/last bracket.
		trim := trimToJSONArray(string(raw))
		if trim == "" || json.Unmarshal([]byte(trim), &items) != nil {
			return GenerateOut{}, fmt.Errorf("invalid JSON from model: %w", err)
		}
	}

	// 2) Server-side validation
	if err := validateQuestions(items, p.Formats); err != nil {
		return GenerateOut{}, err
	}

	// Infer title/format for convenience
	infTitle := p.Title
	if infTitle == "" {
		if p.Topic != "" { infTitle = fmt.Sprintf("%s (%d)", p.Topic, len(items)) } else { infTitle = "Exercise Set" }
	}
	infFormat := inferFormat(items)

	return GenerateOut{
		InferredTitle:  infTitle,
		InferredFormat: infFormat,
		Questions:      items,
	}, nil
}

func (c *OpenAIClient) Remix(ctx context.Context, p RemixParams) (db.ExerciseSet, error) {
	// Simple remix: ask to transform difficulty/format/count using parent questions as context
	parentJSON, _ := json.Marshal(p.Parent.Questions)
	userPrompt := fmt.Sprintf(
`Remix the following questions with transforms:
- Harder: %v
- Reduce to: %d (0 = keep)
- Switch format to: %s (empty = keep)
Return STRICT JSON array as previously defined.
Parent questions:
%s`, p.Harder, p.ReduceTo, p.Transform, string(parentJSON))

	raw, err := c.chat(ctx, sysPrompt, userPrompt)
	if err != nil { return db.ExerciseSet{}, err }

	var items []db.Question
	if err := json.Unmarshal(raw, &items); err != nil {
		trim := trimToJSONArray(string(raw))
		if trim == "" || json.Unmarshal([]byte(trim), &items) != nil {
			return db.ExerciseSet{}, fmt.Errorf("invalid JSON from model: %w", err)
		}
	}
	if err := validateQuestions(items, nil); err != nil {
		return db.ExerciseSet{}, err
	}
	return db.ExerciseSet{
		Title:     p.Parent.Title + " (Remix)",
		Format:    inferFormat(items),
		Questions: items,
		Meta: db.ExerciseMeta{
			Difficulty: p.Parent.Meta.Difficulty,
			Language:   p.Parent.Meta.Language,
			Source:     db.ExerciseSource{Type: "remix"},
		},
		Visibility: "private",
	}, nil
}

func builderPrompt(p GenerateParams) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Generate %d questions.\n", p.Count)
	fmt.Fprintf(&sb, "Formats: %s.\n", strings.Join(p.Formats, ","))
	fmt.Fprintf(&sb, "Language: %s. Difficulty: %s.\n", p.Language, p.Difficulty)
	if p.Topic != "" {
		fmt.Fprintf(&sb, "Topic: \"%s\".\n", p.Topic)
	}
	if strings.TrimSpace(p.SourceText) != "" {
		fmt.Fprintf(&sb, "Use ONLY the facts from the source text below.\nSOURCE TEXT:\n%s\n", p.SourceText)
	}
	fmt.Fprintf(&sb, "Return ONLY a JSON array of question objects (no markdown).")
	return sb.String()
}

// Minimal OpenAI Chat call with JSON response handling
func (c *OpenAIClient) chat(ctx context.Context, system string, user string) ([]byte, error) {
	body := map[string]any{
		"model": c.Model,
		"messages": []map[string]string{
			{"role":"system", "content": system},
			{"role":"user",   "content": user},
		},
		"temperature": 0.2,
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.HTTP.Do(req)
	if err != nil { return nil, err }
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		all, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("openai error %d: %s", res.StatusCode, string(all))
	}
	var out struct {
		Choices []struct{
			Message struct{
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil { return nil, err }
	if len(out.Choices) == 0 { return nil, errors.New("no choices") }
	return []byte(out.Choices[0].Message.Content), nil
}

// ---- Helpers ----

func trimToJSONArray(s string) string {
	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start == -1 || end == -1 || end <= start { return "" }
	return s[start : end+1]
}

func validateQuestions(items []db.Question, allowedFormats []string) error {
	// basic invariants
	for i, q := range items {
		if q.Type == "" || strings.TrimSpace(q.Q) == "" {
			return fmt.Errorf("q[%d] missing type or q", i)
		}
		switch q.Type {
		case "mcq":
			if len(q.Options) < 2 {
				return fmt.Errorf("q[%d] mcq requires at least 2 options", i)
			}
			if as, ok := q.Answer.(string); !ok || as == "" {
				return fmt.Errorf("q[%d] mcq answer must be a non-empty string matching an option", i)
			}
		case "true_false":
			switch q.Answer.(type) {
			case bool: // ok
			default:
				return fmt.Errorf("q[%d] true_false answer must be boolean", i)
			}
		case "fill_blank":
			if _, ok := q.Answer.(string); !ok {
				return fmt.Errorf("q[%d] fill_blank answer must be string", i)
			}
		default:
			return fmt.Errorf("q[%d] invalid type %q", i, q.Type)
		}
	}
	// optional: enforce allowedFormats
	if len(allowedFormats) > 0 {
		ok := map[string]bool{}
		for _, f := range allowedFormats { ok[f] = true }
		for i, q := range items {
			if !ok[q.Type] {
				return fmt.Errorf("q[%d] type %q not in allowed formats", i, q.Type)
			}
		}
	}
	return nil
}

func inferFormat(items []db.Question) string {
	seen := map[string]bool{}
	for _, q := range items { seen[q.Type] = true }
	if len(seen) == 1 {
		for k := range seen { return k }
	}
	return "mixed"
}

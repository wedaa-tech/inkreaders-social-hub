package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type OpenAIClient struct {
	Model  string
	APIKey string
	HTTP   *http.Client
}

func NewOpenAI(model string, apiKey string) *OpenAIClient {
	return &OpenAIClient{
		Model:  model,
		APIKey: apiKey,
		HTTP:   http.DefaultClient,
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
	fmt.Printf("[AI raw output] %s\n", string(raw))

	// 1) Parse into a wire shape (what the model returns)
	var wire []wireQuestion
	if err := json.Unmarshal(raw, &wire); err != nil {
		trim := trimToJSONArray(string(raw))
		if trim == "" || json.Unmarshal([]byte(trim), &wire) != nil {
			return GenerateOut{}, fmt.Errorf("invalid JSON from model: %w", err)
		}
	}

	// 2) Validate the wire questions (types, prompts, answers)
	if err := validateWireQuestions(wire, p.Formats); err != nil {
		return GenerateOut{}, err
	}

	// 3) Map to db.Question (your schema)
	items := make([]db.Question, 0, len(wire))
	for i, wq := range wire {
		items = append(items, toDBQuestion(wq, i))
	}

	// 4) Infer title/format
	infTitle := p.Title
	if strings.TrimSpace(infTitle) == "" {
		if p.Topic != "" {
			infTitle = fmt.Sprintf("%s (%d)", p.Topic, len(items))
		} else {
			infTitle = "Exercise Set"
		}
	}
	infFormat := inferWireFormat(wire)

	return GenerateOut{
		InferredTitle:  infTitle,
		InferredFormat: infFormat,
		Questions:      items,
	}, nil
}

func (c *OpenAIClient) Remix(ctx context.Context, p RemixParams) (db.ExerciseSet, error) {
	// Provide parent questions to the model
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
	if err != nil {
		return db.ExerciseSet{}, err
	}
	fmt.Printf("[AI raw output] %s\n", string(raw))

	var wire []wireQuestion
	if err := json.Unmarshal(raw, &wire); err != nil {
		trim := trimToJSONArray(string(raw))
		if trim == "" || json.Unmarshal([]byte(trim), &wire) != nil {
			return db.ExerciseSet{}, fmt.Errorf("invalid JSON from model: %w", err)
		}
	}
	if err := validateWireQuestions(wire, nil); err != nil {
		return db.ExerciseSet{}, err
	}

	items := make([]db.Question, 0, len(wire))
	for i, wq := range wire {
		items = append(items, toDBQuestion(wq, i))
	}

	return db.ExerciseSet{
		Title:     p.Parent.Title + " (Remix)",
		Format:    inferWireFormat(wire),
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

// ---------------- Chat ----------------

func (c *OpenAIClient) chat(ctx context.Context, system string, user string) ([]byte, error) {
	body := map[string]any{
		"model": c.Model,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature": 0.2,
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		all, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("openai error %d: %s", res.StatusCode, string(all))
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Choices) == 0 {
		return nil, errors.New("no choices")
	}
	return []byte(out.Choices[0].Message.Content), nil
}


// Explain generates a concise explanation for the given question prompt and answer.
// answer can be string, bool, or any JSON value — we stringify for safety.
func (c *OpenAIClient) Explain(ctx context.Context, questionID string, prompt string, answer any) (string, error) {
	// Build a focused system prompt that encourages a clear explanation suitable for students.
	sys := `You are a friendly, concise teacher who explains answers for learners preparing for competitive exams.
Be brief but precise. Use short bullet points or 2-3 sentences. Make steps clear if applicable.
OUTPUT: plain text explanation only (no JSON, no markdown).`

	// Build the user prompt including the question/context and the answer
	var ansStr string
	switch v := answer.(type) {
	case nil:
		ansStr = ""
	case string:
		ansStr = v
	default:
		// try to marshal non-string answers to JSON-ish string
		b, _ := json.Marshal(v)
		ansStr = string(b)
	}

	user := "Question:\n" + prompt + "\n\nAnswer:\n" + ansStr + "\n\nExplain why this answer is correct and provide brief steps or a short rationale."

	// call chat helper (re-uses your existing chat code)
	raw, err := c.chat(ctx, sys, user)
	if err != nil {
		return "", err
	}

	// chat returns raw bytes from the model response; we trim whitespace
	out := strings.TrimSpace(string(raw))
	// Optional: if model returns JSON or extraneous content, try to trim to first paragraph
	if out == "" {
		return "", errors.New("empty explanation returned by model")
	}
	return out, nil
}


// --------------- Wire <-> DB mapping ---------------

type wireQuestion struct {
	Type         string      `json:"type"`
	Q            string      `json:"q"`
	Prompt       string      `json:"prompt"`
	Question     string      `json:"question"`
	Text         string      `json:"text"`
	Statement    string      `json:"statement"`
	Options      []string    `json:"options"`
	Choices      []string    `json:"choices"`
	Answer       any         `json:"answer"`
	CorrectAns   any         `json:"correct_answer"`
	Explain      string      `json:"explain"`
	Explanation  string      `json:"explanation"`
}

func (w wireQuestion) normPrompt() string {
	if s := strings.TrimSpace(w.Prompt); s != "" {
		return s
	}
	if s := strings.TrimSpace(w.Q); s != "" {
		return s
	}
	if s := strings.TrimSpace(w.Question); s != "" {
		return s
	}
	if s := strings.TrimSpace(w.Text); s != "" {
		return s
	}
	if s := strings.TrimSpace(w.Statement); s != "" {
		return s
	}
	return ""
}

func (w wireQuestion) normOptions() []string {
	if len(w.Options) > 0 {
		return w.Options
	}
	if len(w.Choices) > 0 {
		return w.Choices
	}
	return nil
}

func (w wireQuestion) normAnswer() any {
	if w.CorrectAns != nil {
		return w.CorrectAns
	}
	return w.Answer
}

func (w wireQuestion) normExplanation() string {
	if s := strings.TrimSpace(w.Explanation); s != "" {
		return s
	}
	return strings.TrimSpace(w.Explain)
}

func toDBQuestion(w wireQuestion, idx int) db.Question {
	return db.Question{
		ID:            fmt.Sprintf("q%d", idx+1),
		Type:          w.Type,
		Prompt:        w.normPrompt(),
		Options:       w.normOptions(),
		CorrectAnswer: w.normAnswer(),
		Explanation:   w.normExplanation(),
		OrderIndex:    idx,
	}
}

// --------------- Validation / Inference ---------------

func validateWireQuestions(items []wireQuestion, allowedFormats []string) error {
	for i, q := range items {
		if strings.TrimSpace(q.Type) == "" || strings.TrimSpace(q.normPrompt()) == "" {
			return fmt.Errorf("q[%d] missing type or prompt", i)
		}
		switch q.Type {
		case "mcq":
			opts := q.normOptions()
			if len(opts) < 2 {
				return fmt.Errorf("q[%d] mcq requires at least 2 options", i)
			}
			if _, ok := q.normAnswer().(string); !ok {
				return fmt.Errorf("q[%d] mcq answer must be a string (one of the options)", i)
			}
		case "true_false":
			switch q.normAnswer().(type) {
			case bool:
				// ok
			case string:
				// allow "true"/"false" as string
				// (frontend/normalizer will coerce for checking)
			default:
				return fmt.Errorf("q[%d] true_false answer must be boolean or 'true'/'false' string", i)
			}
		case "fill_blank":
			if _, ok := q.normAnswer().(string); !ok {
				return fmt.Errorf("q[%d] fill_blank answer must be string", i)
			}
		case "mixed":
			// Accept; your DB allows 'mixed'
		default:
			return fmt.Errorf("q[%d] invalid type %q", i, q.Type)
		}
	}

	// Optional: enforce allowedFormats if provided
	if len(allowedFormats) > 0 {
		ok := map[string]bool{}
		for _, f := range allowedFormats {
			ok[f] = true
		}
		for i, q := range items {
			if !ok[q.Type] {
				return fmt.Errorf("q[%d] type %q not in allowed formats", i, q.Type)
			}
		}
	}
	return nil
}

func inferWireFormat(items []wireQuestion) string {
	seen := map[string]bool{}
	for _, q := range items {
		seen[q.Type] = true
	}
	if len(seen) == 1 {
		for k := range seen {
			return k
		}
	}
	return "mixed"
}

// --------------- JSON trimming helper ---------------

func trimToJSONArray(s string) string {
	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start == -1 || end == -1 || end <= start {
		return ""
	}
	return s[start : end+1]
}


// GenerateResponse generates a free-text AI response for a notebook topic
func (c *OpenAIClient) GenerateResponse(ctx context.Context, prompt string) (string, error) {
    sys := `You are a helpful tutor. 
Respond to the user's request with a clear, structured, plain text (Markdown ok).
Avoid JSON or code formatting unless explicitly asked.`

    raw, err := c.chat(ctx, sys, prompt)
    if err != nil {
        return "", err
    }
    return strings.TrimSpace(string(raw)), nil
}


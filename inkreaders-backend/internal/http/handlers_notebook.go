package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
	"fmt"
	"github.com/google/uuid"
	"github.com/go-chi/chi/v5"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type createTopicIn struct {
	Title  string         `json:"title"`
	Prompt string         `json:"prompt"`
	Tags   []string       `json:"tags"`
	Meta   map[string]any `json:"meta"`
}

type updateTopicIn struct {
	Title               *string    `json:"title,omitempty"`
	Description         *string    `json:"description,omitempty"`
	Tags                []string   `json:"tags,omitempty"`
	CanonicalResponseID *uuid.UUID `json:"canonical_response_id,omitempty"`
}

// --- Topics ---

func (h *Handlers) ListTopics(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	q := r.URL.Query()

	limit := 20
	if l := q.Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}
	cursor := q.Get("cursor")

	topics, nextCursor, err := h.Store.ListTopics(ctx, s.AccountID, limit, cursor)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"items":      topics,
		"nextCursor": nextCursor,
	})
}

// CreateTopic - POST /api/topics
func (h *Handlers) CreateTopic(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	var in createTopicIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	// 1. Insert Topic
	topic, err := h.Store.CreateTopic(ctx, s.AccountID, in.Title, in.Prompt, in.Tags, in.Meta)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Create placeholder response
	placeholderRaw := map[string]any{
		"note":   "placeholder - initial response will be generated async",
		"prompt": in.Prompt,
	}
	initialResp, err := h.Store.CreateResponse(
		ctx,
		topic.ID,
		nil,
		"ai",
		"Generating…",
		"",
		placeholderRaw,
	)
	if err != nil {
		// Not fatal: return topic anyway
		initialResp = db.Response{}
	}

	// 3. Kick off background AI generation
	go func(respID uuid.UUID, prompt string) {
		ctx2 := context.Background()
		aiResp, err := h.AI.GenerateResponse(ctx2, prompt)
		if err != nil {
			fmt.Printf("[AI error] respID=%s prompt=%q err=%v\n", respID, prompt, err)
			return
		}

		// TODO: sanitize Markdown -> HTML
		html := aiResp

		if err := h.Store.UpdateResponse(ctx2, respID, aiResp, html, map[string]any{
			"source": "ai",
			"prompt": prompt,
		}); err != nil {
			fmt.Printf("[AI error] failed to update response: %v\n", err)
		}
	}(initialResp.ID, in.Prompt)


	// 4. Return immediately
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"topic":           topic,
		"initialResponse": initialResp,
	})
}


func (h *Handlers) GetTopic(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	topic, responses, err := h.Store.GetTopicWithResponses(ctx, id, 20, "")
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"topic":     topic,
		"responses": responses,
	})
}

func (h *Handlers) UpdateTopic(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var in updateTopicIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	if err := h.Store.UpdateTopic(ctx, id, in.Title, in.Description, in.Tags, in.CanonicalResponseID); err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Responses ---

func (h *Handlers) ListResponses(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	topicID, err := uuid.Parse(chi.URLParam(r, "topic_id"))
	if err != nil {
		http.Error(w, "invalid topic_id", http.StatusBadRequest)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}
	cursor := time.Now()
	if c := r.URL.Query().Get("cursor"); c != "" {
		if t, err := time.Parse(time.RFC3339, c); err == nil {
			cursor = t
		}
	}

	resps, err := h.Store.ListResponsesByTopic(ctx, topicID, limit, cursor)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(resps)
}

type createResponseIn struct {
	ParentResponseID *uuid.UUID      `json:"parent_response_id"`
	Content          string          `json:"content"`
	SystemPrompt     string          `json:"system_prompt"`
	LLMOptions       json.RawMessage `json:"llm_options"`
}

func (h *Handlers) CreateResponse(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	topicID, err := uuid.Parse(chi.URLParam(r, "topic_id"))
	if err != nil {
		http.Error(w, "invalid topic_id", http.StatusBadRequest)
		return
	}

	var in createResponseIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	authorType := "user"
	raw := map[string]any{}
	if len(in.LLMOptions) > 0 {
		_ = json.Unmarshal(in.LLMOptions, &raw)
	}

	resp, err := h.Store.CreateResponse(ctx, topicID, in.ParentResponseID, authorType, in.Content, "", raw)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *Handlers) GetResponse(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	resp, err := h.Store.GetResponse(ctx, id)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(resp)
}

type updateResponseIn struct {
	Content     string          `json:"content"`
	ContentHTML string          `json:"content_html"`
	Raw         json.RawMessage `json:"raw"`
}

func (h *Handlers) UpdateResponse(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var in updateResponseIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	raw := map[string]any{}
	if len(in.Raw) > 0 {
		_ = json.Unmarshal(in.Raw, &raw)
	}

	if err := h.Store.UpdateResponse(ctx, id, in.Content, in.ContentHTML, raw); err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


// --- GET /api/responses/{id}/versions
func (h *Handlers) ListResponseVersions(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	respID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid response id", http.StatusBadRequest)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}

	versions, err := h.Store.ListResponseVersions(ctx, respID, limit)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(versions)
}

// --- GET /api/responses/versions/{version_id}
func (h *Handlers) GetResponseVersion(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	versionID, err := uuid.Parse(chi.URLParam(r, "version_id"))
	if err != nil {
		http.Error(w, "invalid version id", http.StatusBadRequest)
		return
	}

	v, err := h.Store.GetResponseVersion(ctx, versionID)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}


// --- Highlights ---
func (h *Handlers) ListHighlights(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	topicID, err := uuid.Parse(chi.URLParam(r, "topic_id"))
	if err != nil {
		http.Error(w, "invalid topic_id", 400)
		return
	}

	items, err := h.Store.ListHighlightsByTopic(ctx, topicID)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}
	_ = json.NewEncoder(w).Encode(items)
}

type createHighlightIn struct {
	ResponseID string  `json:"response_id"`
	Excerpt    string  `json:"excerpt"`
	Color      string  `json:"color"`
	Note       *string `json:"note,omitempty"`
}

func (h *Handlers) CreateHighlight(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	topicID, err := uuid.Parse(chi.URLParam(r, "topic_id"))
	if err != nil {
		http.Error(w, "invalid topic_id", 400)
		return
	}

	var in createHighlightIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	respID, _ := uuid.Parse(in.ResponseID)

	item, err := h.Store.CreateHighlight(ctx, topicID, respID, s.AccountID, in.Excerpt, in.Color, in.Note)
	if err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}
	_ = json.NewEncoder(w).Encode(item)
}

type updateHighlightIn struct {
	Color string  `json:"color"`
	Note  *string `json:"note,omitempty"`
}

func (h *Handlers) UpdateHighlight(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}
	var in updateHighlightIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	if err := h.Store.UpdateHighlight(ctx, id, in.Color, in.Note); err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

func (h *Handlers) DeleteHighlight(w http.ResponseWriter, r *http.Request, s *SessionData) {
	ctx := r.Context()
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}
	if err := h.Store.DeleteHighlight(ctx, id); err != nil {
		http.Error(w, "db error: "+err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

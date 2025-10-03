package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"
	"log"
	"io"
	"bytes"       
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type ExercisesGenerateReq struct {
	Title      string   `json:"title"`
	Topic      string   `json:"topic"`
	Formats    []string `json:"formats"`
	Count      int      `json:"count"`
	Source     struct {
		Type string `json:"type"`
	} `json:"source"`
	Text       string  `json:"text,omitempty"`
	FileID     *string `json:"file_id,omitempty"`
	Difficulty string  `json:"difficulty"`
	Language   string  `json:"language"`
	SeedSetID  *string `json:"seed_set_id,omitempty"`
}

type ExercisesSaveReq struct {
	ExerciseSet db.ExerciseSet `json:"exercise_set"`
	Visibility  string         `json:"visibility"`
}

// === Generate Exercises ===
func (h *Handlers) ExercisesGenerate(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}

	var req ExercisesGenerateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid_json")
		return
	}
	if req.Count <= 0 || req.Count > 50 {
		req.Count = 5
	}
	if len(req.Formats) == 0 {
		req.Formats = []string{"mcq"}
	}
	if req.Difficulty == "" {
		req.Difficulty = "mixed"
	}
	if req.Language == "" {
		req.Language = "en"
	}
	for i, f := range req.Formats {
		req.Formats[i] = normalizeFormat(f)
	}

	out, err := h.AI.Generate(r.Context(), ai.GenerateParams{
		Title:      req.Title,
		Topic:      req.Topic,
		Formats:    req.Formats,
		Count:      req.Count,
		Language:   req.Language,
		Difficulty: req.Difficulty,
	})
	if err != nil {
		set := db.ExerciseSet{
			ID:     uuid.New().String(),
			UserID: s.UserID,
			Title:  coalesce(req.Title, "Untitled Exercise"),
			Format: "mcq",
			Questions: []db.Question{},
			Meta: db.ExerciseMeta{
				Difficulty: req.Difficulty,
				Language:   req.Language,
				Source: db.ExerciseSource{Type: req.Source.Type, Topic: req.Topic},
				SeedSetID: parseUUIDPtr(req.SeedSetID),
			},
			Visibility: "private",
			CreatedAt:  time.Now(),
		}
		WriteJSON(w, http.StatusOK, map[string]any{
			"exercise_set": set,
			"error":        "generation_failed",
			"message":      err.Error(),
		})
		return
	}

	set := db.ExerciseSet{
		ID:     uuid.New().String(),
		UserID: s.UserID,
		Title:  coalesce(req.Title, out.InferredTitle),
		Format: normalizeFormat(out.InferredFormat),
		Questions: out.Questions,
		Meta: db.ExerciseMeta{
			Difficulty: req.Difficulty,
			Language:   req.Language,
			Source: db.ExerciseSource{Type: req.Source.Type, Topic: req.Topic},
			SeedSetID: parseUUIDPtr(req.SeedSetID),
		},
		Visibility: "private",
		CreatedAt:  time.Now(),
	}

	WriteJSON(w, http.StatusOK, map[string]any{"exercise_set": set})
}

func parseUUIDPtr(s *string) *uuid.UUID {
	if s == nil {
		return nil
	}
	if u, err := uuid.Parse(*s); err == nil {
		return &u
	}
	return nil
}

// === Save Exercises ===
func (h *Handlers) ExercisesSave(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}

	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		BadRequest(w, "read_body_failed")
		log.Printf("[SAVE] read_body_failed: %+v", err)
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(rawBody))
	log.Printf("[SAVE] raw request: %s", string(rawBody))

	var raw map[string]any
	if err := json.Unmarshal(rawBody, &raw); err != nil {
		BadRequest(w, "invalid_json")
		return
	}
	if es, ok := raw["exercise_set"].(map[string]any); ok {
		if arr, ok := es["questions"].([]any); ok {
			for i, v := range arr {
				q, ok := v.(map[string]any)
				if !ok {
					continue
				}
				if _, hasSnake := q["correct_answer"]; !hasSnake {
					if val, hasCamel := q["correctAnswer"]; hasCamel {
						q["correct_answer"] = val
						delete(q, "correctAnswer")
					}
				}
				if q["correct_answer"] == nil {
					q["correct_answer"] = ""
				}
				arr[i] = q
			}
			es["questions"] = arr
		}
		raw["exercise_set"] = es
	}
	normBody, _ := json.Marshal(raw)

	var req ExercisesSaveReq
	if err := json.Unmarshal(normBody, &req); err != nil {
		BadRequest(w, "invalid_json_after_norm")
		return
	}

	if req.ExerciseSet.ID == "" {
		req.ExerciseSet.ID = uuid.New().String()
	}
	req.ExerciseSet.UserID = s.UserID
	req.ExerciseSet.Visibility = normalizeVisibility(req.Visibility)

	for i := range req.ExerciseSet.Questions {
		if req.ExerciseSet.Questions[i].CorrectAnswer == nil {
			req.ExerciseSet.Questions[i].CorrectAnswer = ""
		}
	}

	if err := h.DB.InsertExerciseSet(r.Context(), &req.ExerciseSet); err != nil {
		ServerError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{
		"id":     req.ExerciseSet.ID,
		"status": "saved",
	})
}

// === List My Exercises ===
func (h *Handlers) ExercisesMine(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	items, _, err := h.DB.ListExerciseSets(r.Context(), s.UserID, "", 50, "all")
	if err != nil {
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// === Get One Exercise ===
func (h *Handlers) ExercisesGet(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	id := Param(r, "id")
	set, err := h.DB.GetExerciseSet(r.Context(), id, s.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			NotFound(w)
			return
		}
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"exercise_set": set})
}

// === Update Exercise ===
func (h *Handlers) ExercisesUpdate(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	id := Param(r, "id")
	var patch db.ExercisePatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		BadRequest(w, "invalid_json")
		return
	}
	if err := h.DB.UpdateExerciseSet(r.Context(), id, s.UserID, &patch); err != nil {
		if errors.Is(err, db.ErrForbidden) {
			Forbidden(w)
			return
		}
		ServerError(w, err)
		return
	}
	NoContent(w)
}

// === Publish Exercise ===
func (h *Handlers) ExercisesPublish(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	id := Param(r, "id")
	var req struct {
		ToFeed     bool `json:"to_feed"`
		AllowRemix bool `json:"allow_remix"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	set, err := h.DB.GetExerciseSet(r.Context(), id, s.UserID)
	if err != nil {
		ServerError(w, err)
		return
	}
	uri, cid, feedURI, err := h.Pub.PublishExerciseSet(r.Context(), s, *set, req.AllowRemix)
	if err != nil {
		ServerError(w, err)
		return
	}
	_, err = h.DB.Pool.Exec(r.Context(),
		`UPDATE app.exercise_sets 
		 SET at_uri=$1, cid=$2, feed_uri=$3, updated_at=now()
		 WHERE id=$4 AND user_id=$5`,
		uri, cid, feedURI, id, s.UserID)
	if err != nil {
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"at_uri": uri, "cid": cid, "feed_uri": feedURI})
}

// === Remix Exercise ===
func (h *Handlers) ExercisesRemix(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	id := Param(r, "id")
	var req struct {
		Transform struct {
			IncreaseDifficulty bool   `json:"increase_difficulty"`
			ReduceCountTo      int    `json:"reduce_count_to"`
			SwitchFormatTo     string `json:"switch_format_to"`
		} `json:"transform"`
		Note string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	parent, err := h.DB.GetExerciseSet(r.Context(), id, s.UserID)
	if err != nil {
		ServerError(w, err)
		return
	}
	derived, err := h.AI.Remix(r.Context(), ai.RemixParams{
		Parent:    *parent,
		Transform: req.Transform.SwitchFormatTo,
		Harder:    req.Transform.IncreaseDifficulty,
		ReduceTo:  req.Transform.ReduceCountTo,
		Note:      req.Note,
	})
	if err != nil {
		ServerError(w, err)
		return
	}
	if u, err := uuid.Parse(parent.ID); err == nil {
		derived.ParentSetID = &u
	}
	derived.UserID = s.UserID
	if err := h.DB.InsertExerciseSet(r.Context(), &derived); err != nil {
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"derived_set_id": derived.ID, "parent_set_id": parent.ID})
}

// === Upload File for Exercises ===
func (h *Handlers) ExercisesUpload(w http.ResponseWriter, r *http.Request, s *SessionData) {
	if s == nil {
		http.Error(w, "login required", http.StatusUnauthorized)
		return
	}
	f, header, err := r.FormFile("file")
	if err != nil {
		BadRequest(w, "file_required")
		return
	}
	defer f.Close()

	buf, err := io.ReadAll(f)
	if err != nil {
		ServerError(w, err)
		return
	}
	mime := DetectMIME(header.Filename, buf)
	key := h.Storage.Put(r.Context(), generateStorageKey(s.UserID.String(), header.Filename), buf)

	text := h.Extract.PlainText(mime, buf)
	fileRow := db.File{
		ID:         uuid.New().String(),
		UserID:     s.UserID,
		Mime:       mime,
		StorageKey: key,
		Pages:      countPages(mime, buf),
		Chars:      len(text),
	}
	if err := h.DB.InsertFile(r.Context(), &fileRow); err != nil {
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"file_id": fileRow.ID, "mime": mime, "pages": fileRow.Pages, "chars": fileRow.Chars})
}

// === Explain a question ===
func (h *Handlers) ExercisesExplain(w http.ResponseWriter, r *http.Request, s *SessionData) {
	type reqBody struct {
		QuestionID string      `json:"question_id"`
		Prompt     string      `json:"prompt"`
		Answer     interface{} `json:"answer,omitempty"`
	}
	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid_json")
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		BadRequest(w, "prompt_required")
		return
	}
	expl, err := h.AI.Explain(r.Context(), req.QuestionID, req.Prompt, req.Answer)
	if err != nil {
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"explanation": expl})
}

// Helpers
func generateStorageKey(userID string, name string) string {
	ts := time.Now().UTC().Format("20060102T150405")
	ext := filepath.Ext(name)
	return "uploads/" + userID + "/" + ts + ext
}

func normalizeFormat(f string) string {
	switch f {
	case "mcq", "MCQ":
		return "mcq"
	case "truefalse", "true_false", "trueFalse":
		return "true_false"
	case "fillblank", "fill_blank", "fillBlank":
		return "fill_blank"
	case "match", "matching":
		return "match"
	default:
		return "mcq"
	}
}

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


	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/ai"
	"github.com/wedaa-tech/inkreaders-social-hub/inkreaders-backend/internal/db"
)

type ExercisesGenerateReq struct {
	Title      string   `json:"title"`
	Topic      string   `json:"topic"`
	Formats    []string `json:"formats"`              // ["mcq","fill_blank","true_false"]
	Count      int      `json:"count"`
	Source     struct {
		Type string `json:"type"` // "topic"|"text"|"file"|"remix"
	} `json:"source"`
	Text       string  `json:"text,omitempty"`    // if type=text
	FileID     *string `json:"file_id,omitempty"` // if type=file
	Difficulty string  `json:"difficulty"`        // "easy"|"medium"|"hard"|"mixed"
	Language   string  `json:"language"`          // "en" default
	SeedSetID  *string `json:"seed_set_id,omitempty"`
}

type ExercisesSaveReq struct {
	ExerciseSet db.ExerciseSet `json:"exercise_set"`
	Visibility  string         `json:"visibility"` // private|unlisted|public
}

// === Generate Exercises ===
func (h *Handlers) ExercisesGenerate(w http.ResponseWriter, r *http.Request, s *SessionData) {
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

	// Normalize requested format(s) before AI call
	for i, f := range req.Formats {
		req.Formats[i] = normalizeFormat(f)
	}

	// AI call
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
			UserID: "",
			Title:  coalesce(req.Title, "Untitled Exercise"),
			Format: "mcq",
			Questions: []db.Question{},
			Meta: db.ExerciseMeta{
				Difficulty: req.Difficulty,
				Language:   req.Language,
				Source: db.ExerciseSource{
					Type:  req.Source.Type,
					Topic: req.Topic,
				},
				SeedSetID: req.SeedSetID,
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

	userID := s.AccountID
	if userID == "" {
		userID = h.did // fallback
	}

	set := db.ExerciseSet{
		ID:     uuid.New().String(),
		UserID: userID,
		Title:  coalesce(req.Title, out.InferredTitle),
		// ✅ Normalize AI output format before saving
		Format: normalizeFormat(out.InferredFormat),
		Questions: out.Questions,
		Meta: db.ExerciseMeta{
			Difficulty: req.Difficulty,
			Language:   req.Language,
			Source: db.ExerciseSource{
				Type:  req.Source.Type,
				Topic: req.Topic,
			},
			SeedSetID: req.SeedSetID,
		},
		Visibility: "private",
		CreatedAt:  time.Now(),
	}

	WriteJSON(w, http.StatusOK, map[string]any{"exercise_set": set})
}


// === Save Exercises ===
func (h *Handlers) ExercisesSave(w http.ResponseWriter, r *http.Request, s *SessionData) {
	// 0) Read the raw body so we can log & normalize shape
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		BadRequest(w, "read_body_failed")
		log.Printf("[SAVE] read_body_failed: %+v", err)
		return
	}
	// rehydrate body for downstream decoders
	r.Body = io.NopCloser(bytes.NewReader(rawBody))

	log.Printf("[SAVE] raw request: %s", string(rawBody))

	// 1) Decode into generic map so we can normalize keys like correctAnswer -> correct_answer
	var raw map[string]any
	if err := json.Unmarshal(rawBody, &raw); err != nil {
		BadRequest(w, "invalid_json")
		log.Printf("[SAVE] invalid_json (raw unmarshal): %+v", err)
		return
	}

	// 2) Inspect & normalize the exercise_set.questions shape
	if es, ok := raw["exercise_set"].(map[string]any); ok {
		// DEBUG: log top-level fields
		log.Printf("[SAVE] exercise_set keys: %v", keysOf(es))

		// Log first raw question before normalization
		if arr, ok := es["questions"].([]any); ok && len(arr) > 0 {
			if q0, ok := arr[0].(map[string]any); ok {
				log.Printf("[SAVE] q0 BEFORE norm: type=%v, prompt=%v, correct_answer=%v, correctAnswer=%v",
					q0["type"], q0["prompt"], q0["correct_answer"], q0["correctAnswer"])
			}
			// Normalize each question
			for i, v := range arr {
				q, ok := v.(map[string]any)
				if !ok {
					continue
				}
				// If client sent camelCase correctAnswer, map to snake_case
				if _, hasSnake := q["correct_answer"]; !hasSnake {
					if val, hasCamel := q["correctAnswer"]; hasCamel {
						q["correct_answer"] = val
						delete(q, "correctAnswer")
					}
				}
				// Defensive: if still nil, set empty string to avoid null in DB
				if q["correct_answer"] == nil {
					q["correct_answer"] = ""
				}
				arr[i] = q
			}
			es["questions"] = arr

			// DEBUG: log first question after normalization
			if q0, ok := arr[0].(map[string]any); ok {
				log.Printf("[SAVE] q0 AFTER  norm: type=%v, prompt=%v, correct_answer=%v",
					q0["type"], q0["prompt"], q0["correct_answer"])
			}
		}
		raw["exercise_set"] = es
	} else {
		log.Printf("[SAVE] WARNING: request missing exercise_set object")
	}

	// 3) Re-marshal the normalized payload, then decode into the strong type
	normBody, _ := json.Marshal(raw)

	var req ExercisesSaveReq
	if err := json.Unmarshal(normBody, &req); err != nil {
		BadRequest(w, "invalid_json_after_norm")
		log.Printf("[SAVE] invalid_json_after_norm: %+v", err)
		log.Printf("[SAVE] normalized payload: %s", string(normBody))
		return
	}

	// 4) Final server-side defaults
	if req.ExerciseSet.ID == "" {
		req.ExerciseSet.ID = uuid.New().String()
	}
	req.ExerciseSet.UserID = s.AccountID
	req.ExerciseSet.Visibility = normalizeVisibility(req.Visibility)

	// Extra safety: ensure no nil correct_answer sneaks in
	for i := range req.ExerciseSet.Questions {
		if req.ExerciseSet.Questions[i].CorrectAnswer == nil {
			req.ExerciseSet.Questions[i].CorrectAnswer = ""
		}
	}

	// DEBUG: log the first strongly-typed question prior to DB insert
	if len(req.ExerciseSet.Questions) > 0 {
		q0 := req.ExerciseSet.Questions[0]
		log.Printf("[SAVE] typed q0 before insert: type=%s prompt=%q correct_answer=%v",
			q0.Type, q0.Prompt, q0.CorrectAnswer)
	}

	// 5) Insert
	if err := h.DB.InsertExerciseSet(r.Context(), &req.ExerciseSet); err != nil {
		ServerError(w, err)
		log.Printf("[SAVE] DB InsertExerciseSet error: %+v", err)
		return
	}

	// 6) Respond
	WriteJSON(w, http.StatusOK, map[string]string{
		"id":     req.ExerciseSet.ID,
		"status": "saved",
	})
}

// small helper for debug
func keysOf(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// === List My Exercises ===
func (h *Handlers) ExercisesMine(w http.ResponseWriter, r *http.Request, s *SessionData) {
	items, _, err := h.DB.ListExerciseSets(r.Context(), s.AccountID, "", 50, "all")
	if err != nil {
		log.Printf("ListExerciseSets error: %+v", err)
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// === Get One Exercise ===
func (h *Handlers) ExercisesGet(w http.ResponseWriter, r *http.Request, s *SessionData) {
	id := Param(r, "id")
	set, err := h.DB.GetExerciseSet(r.Context(), id, s.AccountID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			NotFound(w)
			return
		}
		ServerError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"exercise_set": set,
		"visibility":   set.Visibility,
		"published":    map[string]any{"at_uri": set.ATURI, "cid": set.CID},
	})
}

// === Update Exercise ===
func (h *Handlers) ExercisesUpdate(w http.ResponseWriter, r *http.Request, s *SessionData) {
	id := Param(r, "id")
	var patch db.ExercisePatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		BadRequest(w, "invalid_json")
		return
	}
	if err := h.DB.UpdateExerciseSet(r.Context(), id, s.AccountID, &patch); err != nil {
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
	id := Param(r, "id")
	var req struct {
		ToFeed     bool `json:"to_feed"`
		AllowRemix bool `json:"allow_remix"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	// 1. Load exercise
	set, err := h.DB.GetExerciseSet(r.Context(), id, s.AccountID)
	if err != nil {
		ServerError(w, err)
		return
	}

	// 2. Publish (returns 4 values now)
	uri, cid, feedURI, err := h.Pub.PublishExerciseSet(r.Context(), s, *set, req.AllowRemix)
	if err != nil {
		ServerError(w, err)
		return
	}

	// 3. Save to DB
	_, err = h.DB.Pool.Exec(r.Context(),
		`UPDATE exercise_sets 
		 SET at_uri=$1, cid=$2, feed_uri=$3, updated_at=now()
		 WHERE id=$4 AND user_id=$5`,
		uri, cid, feedURI, id, s.AccountID)
	if err != nil {
		ServerError(w, err)
		return
	}

	// 4. Response
	WriteJSON(w, http.StatusOK, map[string]string{
		"at_uri":   uri,
		"cid":      cid,
		"feed_uri": feedURI,
	})
}


// === Remix Exercise ===
func (h *Handlers) ExercisesRemix(w http.ResponseWriter, r *http.Request, s *SessionData) {
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

	parent, err := h.DB.GetExerciseSet(r.Context(), id, s.AccountID)
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

	derived.ParentSetID = &parent.ID
	derived.UserID = s.AccountID
	if err := h.DB.InsertExerciseSet(r.Context(), &derived); err != nil {
		ServerError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{
		"derived_set_id": derived.ID,
		"parent_set_id":  parent.ID,
	})
}

// === Upload File for Exercises ===
func (h *Handlers) ExercisesUpload(w http.ResponseWriter, r *http.Request, s *SessionData) {
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
	key := h.Storage.Put(r.Context(), generateStorageKey(s.AccountID, header.Filename), buf)

	text := h.Extract.PlainText(mime, buf)
	fileRow := db.File{
		ID:         uuid.New().String(),
		UserID:     s.AccountID,
		Mime:       mime,
		StorageKey: key,
		Pages:      countPages(mime, buf),
		Chars:      len(text),
	}
	if err := h.DB.InsertFile(r.Context(), &fileRow); err != nil {
		ServerError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"file_id": fileRow.ID,
		"mime":    mime,
		"pages":   fileRow.Pages,
		"chars":   fileRow.Chars,
	})
}

// Helpers
func generateStorageKey(userID, name string) string {
	ts := time.Now().UTC().Format("20060102T150405")
	ext := filepath.Ext(name)
	return "uploads/" + userID + "/" + ts + ext
}

// normalizeFormat maps loose values to canonical DB format values.
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
		return "mcq" // fallback
	}
}



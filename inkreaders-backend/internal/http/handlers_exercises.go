package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"time"
	"log"
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

	// Prepare source text
	var sourceText string
	switch req.Source.Type {
	case "topic":
	case "text":
		sourceText = req.Text
	case "file":
		if req.FileID == nil {
			BadRequest(w, "file_id_required")
			return
		}
		file, err := h.DB.GetFile(r.Context(), *req.FileID, s.AccountID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				NotFound(w)
			} else {
				ServerError(w, err)
			}
			return
		}
		content, err := h.Storage.Read(r.Context(), file.StorageKey)
		if err != nil {
			ServerError(w, err)
			return
		}
		sourceText = h.Extract.PlainText(file.Mime, content)
	default:
		req.Source.Type = "topic"
	}

	// AI call
	out, err := h.AI.Generate(r.Context(), ai.GenerateParams{
		Title:      req.Title,
		Topic:      req.Topic,
		Formats:    req.Formats,
		Count:      req.Count,
		Language:   req.Language,
		Difficulty: req.Difficulty,
		SourceText: sourceText,
	})

	if err != nil {
		// Instead of crashing → return fallback empty set
		set := db.ExerciseSet{
			ID:     uuid.New().String(),
			UserID: "",
			Title:  coalesce(req.Title, "Untitled Exercise"),
			Format: "mcq",
			Questions: []db.Question{}, // ✅ ensure array not nil
			Meta: db.ExerciseMeta{
				Difficulty: req.Difficulty,
				Language:   req.Language,
				Source: db.ExerciseSource{
					Type:   req.Source.Type,
					Topic:  req.Topic,
					FileID: req.FileID,
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
		userID = h.did // fallback to app DID
	}

	set := db.ExerciseSet{
		ID:     uuid.New().String(),
		UserID: userID,
		Title:  coalesce(req.Title, out.InferredTitle),
		Format: out.InferredFormat,
		Questions: out.Questions, // ✅ guaranteed array from AI
		Meta: db.ExerciseMeta{
			Difficulty: req.Difficulty,
			Language:   req.Language,
			Source: db.ExerciseSource{
				Type:   req.Source.Type,
				Topic:  req.Topic,
				FileID: req.FileID,
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
    var req ExercisesSaveReq
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        BadRequest(w, "invalid_json")
        return
    }

    // generate UUID if empty
    if req.ExerciseSet.ID == "" {
        req.ExerciseSet.ID = uuid.New().String()
    }

    req.ExerciseSet.UserID = s.AccountID
    req.ExerciseSet.Visibility = normalizeVisibility(req.Visibility)

    if err := h.DB.InsertExerciseSet(r.Context(), &req.ExerciseSet); err != nil {
        ServerError(w, err)
        return
    }

    WriteJSON(w, http.StatusOK, map[string]string{"id": req.ExerciseSet.ID, "status": "saved"})
}


// === List My Exercises ===
func (h *Handlers) ExercisesMine(w http.ResponseWriter, r *http.Request, s *SessionData) {
    items, _, err := h.DB.ListExerciseSets(r.Context(), s.AccountID, "", 50, "all")
    if err != nil {
        // log exact DB error
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
// === Publish Exercise ===
// === Publish Exercise ===
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

	// 2. Publish custom record into com.inkreaders.exercise.post
	uri, cid, err := h.Pub.PublishExerciseSet(r.Context(), s, set, req.AllowRemix)
	if err != nil {
		ServerError(w, err)
		return
	}

	// 3. Optionally create feed post that embeds the exercise
	if req.ToFeed {
		if err := h.Pub.CreateExercisePost(r.Context(), s, uri, cid, set.Title, 5); err != nil {
			ServerError(w, err)
			return
		}
	}

	// 4. Save to DB
	_, err = h.DB.Pool.Exec(r.Context(),
		`UPDATE exercise_sets 
		 SET at_uri=$1, cid=$2, updated_at=now()
		 WHERE id=$3 AND user_id=$4`,
		uri, cid, id, s.AccountID)
	if err != nil {
		ServerError(w, err)
		return
	}

	// 5. Response
	WriteJSON(w, http.StatusOK, map[string]string{
		"at_uri": uri,
		"cid":    cid,
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
		Parent:    parent,
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

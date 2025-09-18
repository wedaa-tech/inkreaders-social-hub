package db

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrForbidden = errors.New("forbidden")

// ---------- Types ----------

type ExerciseSource struct {
	Type   string     `json:"type"`
	Topic  string     `json:"topic,omitempty"`
	FileID *uuid.UUID `json:"file_id,omitempty"`
}

type ExerciseMeta struct {
	Difficulty string         `json:"difficulty"`
	Language   string         `json:"language"`
	Source     ExerciseSource `json:"source"`
	SeedSetID  *uuid.UUID     `json:"seed_set_id,omitempty"`
}

type Question struct {
	ID            string      `json:"id"`
	Type          string      `json:"type"`
	Prompt        string      `json:"prompt"`
	Options       []string    `json:"options,omitempty"`
	CorrectAnswer any         `json:"correct_answer"`
	Explanation   string      `json:"explanation,omitempty"`
	OrderIndex    int         `json:"order_index,omitempty"`
}

type ExerciseSet struct {
	ID          string       `json:"id"`
	UserID      uuid.UUID    `json:"user_id"`
	Title       string       `json:"title"`
	Format      string       `json:"format"`
	Questions   []Question   `json:"questions"`
	Meta        ExerciseMeta `json:"meta"`
	Visibility  string       `json:"visibility"`
	ParentSetID *uuid.UUID   `json:"parent_set_id,omitempty"`
	ATURI       *string      `json:"at_uri,omitempty"`
	CID         *string      `json:"cid,omitempty"`
	FeedURI     *string      `json:"feed_uri,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type ExercisePatch struct {
	Title      *string       `json:"title,omitempty"`
	Visibility *string       `json:"visibility,omitempty"`
	Questions  *[]Question   `json:"questions,omitempty"`
	Meta       *ExerciseMeta `json:"meta,omitempty"`
}

func toJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// ------------------ CRUD ------------------

func (s *Store) InsertExerciseSet(ctx context.Context, set *ExerciseSet) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO exercise_sets
			(id, user_id, title, format, questions, meta, visibility, parent_set_id, at_uri, cid, feed_uri, created_at, updated_at)
		VALUES
			($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11, now(), now())
		ON CONFLICT (id) DO UPDATE SET
			title=EXCLUDED.title,
			format=EXCLUDED.format,
			questions=EXCLUDED.questions,
			meta=EXCLUDED.meta,
			visibility=EXCLUDED.visibility,
			parent_set_id=EXCLUDED.parent_set_id,
			at_uri=COALESCE(EXCLUDED.at_uri, exercise_sets.at_uri),
			cid=COALESCE(EXCLUDED.cid, exercise_sets.cid),
			feed_uri=COALESCE(EXCLUDED.feed_uri, exercise_sets.feed_uri),
			updated_at=now()
	`, set.ID, set.UserID, set.Title, set.Format, toJSON(set.Questions), toJSON(set.Meta),
		set.Visibility, set.ParentSetID, set.ATURI, set.CID, set.FeedURI)
	return err
}

func (s *Store) GetExerciseSet(ctx context.Context, id string, owner uuid.UUID) (*ExerciseSet, error) {
	var e ExerciseSet
	var qjson, mjson []byte

	err := s.Pool.QueryRow(ctx, `
		SELECT id, user_id, title, format, questions, meta, visibility,
		       parent_set_id, at_uri, cid, feed_uri, created_at, updated_at
		FROM exercise_sets
		WHERE id=$1 AND user_id=$2
	`, id, owner).Scan(
		&e.ID, &e.UserID, &e.Title, &e.Format,
		&qjson, &mjson, &e.Visibility,
		&e.ParentSetID, &e.ATURI, &e.CID, &e.FeedURI, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(qjson, &e.Questions); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(mjson, &e.Meta); err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *Store) UpdateExerciseSet(ctx context.Context, id string, owner uuid.UUID, p *ExercisePatch) error {
	// load existing
	existing, err := s.GetExerciseSet(ctx, id, owner)
	if err != nil {
		return err
	}
	if existing.UserID != owner {
		return ErrForbidden
	}

	if p.Title != nil {
		existing.Title = *p.Title
	}
	if p.Visibility != nil {
		existing.Visibility = *p.Visibility
	}
	if p.Questions != nil {
		existing.Questions = *p.Questions
	}
	if p.Meta != nil {
		existing.Meta = *p.Meta
	}
	existing.UpdatedAt = time.Now()

	return s.InsertExerciseSet(ctx, existing)
}

func (s *Store) MarkPublished(ctx context.Context, id string, owner uuid.UUID, atURI, cid, feedURI string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE exercise_sets
		SET at_uri=$1, cid=$2, feed_uri=$3, updated_at=now()
		WHERE id=$4 AND user_id=$5
	`, atURI, cid, feedURI, id, owner)
	return err
}

func (s *Store) ListExerciseSets(ctx context.Context, owner uuid.UUID, cursor string, limit int, visibility string) ([]ExerciseSet, string, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id, user_id, title, format, meta, visibility, parent_set_id, at_uri, cid, feed_uri, created_at, updated_at
		FROM exercise_sets
		WHERE user_id=$1
		ORDER BY created_at DESC
		LIMIT $2
	`, owner, limit)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var out []ExerciseSet
	for rows.Next() {
		var e ExerciseSet
		var mjson []byte
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.Title, &e.Format,
			&mjson, &e.Visibility, &e.ParentSetID, &e.ATURI, &e.CID, &e.FeedURI,
			&e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, "", err
		}
		if err := json.Unmarshal(mjson, &e.Meta); err != nil {
			return nil, "", err
		}
		out = append(out, e)
	}

	return out, "", nil
}

// ------------------ File Handling ------------------

type File struct {
	ID         string    `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	Mime       string    `json:"mime"`
	StorageKey string    `json:"storage_key"`
	Pages      int       `json:"pages"`
	Chars      int       `json:"chars"`
}

func (s *Store) InsertFile(ctx context.Context, f *File) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO files (id, user_id, mime, storage_key, pages, chars)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, f.ID, f.UserID, f.Mime, f.StorageKey, f.Pages, f.Chars)
	return err
}

func (s *Store) GetFile(ctx context.Context, id string, owner uuid.UUID) (File, error) {
	var f File
	err := s.Pool.QueryRow(ctx, `
		SELECT id, user_id, mime, storage_key, pages, chars
		FROM files
		WHERE id=$1 AND user_id=$2
	`, id, owner).Scan(&f.ID, &f.UserID, &f.Mime, &f.StorageKey, &f.Pages, &f.Chars)
	return f, err
}

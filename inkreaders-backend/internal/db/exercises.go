package db

import (
	"context"
	"errors"
	"time"
)

var ErrForbidden = errors.New("forbidden")

type ExerciseSource struct {
	Type   string  `json:"type"`              // topic|text|file|remix
	Topic  string  `json:"topic,omitempty"`
	FileID *string `json:"file_id,omitempty"`
}

type ExerciseMeta struct {
	Difficulty string         `json:"difficulty"`
	Language   string         `json:"language"`
	Source     ExerciseSource `json:"source"`
	SeedSetID  *string        `json:"seed_set_id,omitempty"`
}

type Question struct {
	Type    string   `json:"type"`
	Q       string   `json:"q"`
	Options []string `json:"options,omitempty"`
	Answer  any      `json:"answer"`
	Explain string   `json:"explain,omitempty"`
}

type ExerciseSet struct {
	ID         string      `json:"id"`
	UserID     string      `json:"user_id"`
	Title      string      `json:"title"`
	Format     string      `json:"format"`
	Questions  []Question  `json:"questions"`
	Meta       ExerciseMeta`json:"meta"`
	Visibility string      `json:"visibility"`
	ParentSetID *string    `json:"parent_set_id,omitempty"`
	ATURI      string      `json:"at_uri,omitempty"`
	CID        string      `json:"cid,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

type ExercisePatch struct {
	Title      *string     `json:"title,omitempty"`
	Visibility *string     `json:"visibility,omitempty"`
	Questions  *[]Question `json:"questions,omitempty"`
	Meta       *ExerciseMeta `json:"meta,omitempty"`
}

func (s *Store) InsertExerciseSet(ctx context.Context, e *ExerciseSet) error { /* INSERT ... */ return nil }
func (s *Store) GetExerciseSet(ctx context.Context, id, owner string) (ExerciseSet, error) { /* SELECT with owner check */ return ExerciseSet{}, nil }
func (s *Store) UpdateExerciseSet(ctx context.Context, id, owner string, p *ExercisePatch) error { /* UPDATE with owner */ return nil }
func (s *Store) MarkPublished(ctx context.Context, id, owner, atURI, cid string) error { /* UPDATE */ return nil }
func (s *Store) ListExerciseSets(ctx context.Context, owner, cursor string, limit int, visibility string) ([]ExerciseSet, string, error) { /* SELECT ... */ return nil, "", nil }

type File struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Mime       string `json:"mime"`
	StorageKey string `json:"storage_key"`
	Pages      int    `json:"pages"`
	Chars      int    `json:"chars"`
}

func (s *Store) InsertFile(ctx context.Context, f *File) error { return nil }
func (s *Store) GetFile(ctx context.Context, id, owner string) (File, error) { return File{}, nil }

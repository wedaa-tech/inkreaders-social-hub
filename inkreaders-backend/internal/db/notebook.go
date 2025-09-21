package db

import (
	"context"
	"encoding/json"
	"time"
	"strconv"
	"strings" 

	"github.com/google/uuid"
)

// --- Models ---

type Topic struct {
	ID                  uuid.UUID              `json:"id"`
	UserID              uuid.UUID              `json:"userId"`
	Title               string                 `json:"title"`
	Description         string                 `json:"description"`
	Tags                []string               `json:"tags"`
	Meta                map[string]any         `json:"meta"`
	CanonicalResponseID *uuid.UUID             `json:"canonicalResponseId,omitempty"`
	CreatedAt           time.Time              `json:"createdAt"`
	UpdatedAt           time.Time              `json:"updatedAt"`
}

type Response struct {
	ID               uuid.UUID             `json:"id"`
	TopicID          uuid.UUID             `json:"topicId"`
	ParentResponseID *uuid.UUID            `json:"parentResponseId,omitempty"`
	AuthorType       string                `json:"authorType"`
	Content          string                `json:"content"`
	ContentHTML      string                `json:"contentHtml"`
	Raw              map[string]any        `json:"raw"`
	CreatedAt        time.Time             `json:"createdAt"`
	UpdatedAt        time.Time             `json:"updatedAt"`
	Status           string                `json:"status"`
}


type ResponseVersion struct {
	ID          uuid.UUID              `json:"id"`
	ResponseID  uuid.UUID              `json:"responseId"`
	VersionNum  int                    `json:"versionNumber"`
	Content     string                 `json:"content"`
	ContentHTML string                 `json:"contentHtml"`
	Raw         map[string]any         `json:"raw"`
	CreatedAt   time.Time              `json:"createdAt"`
}

// --- Highlights ---
type Highlight struct {
	ID         uuid.UUID  `json:"id"`
	TopicID    uuid.UUID  `json:"topic_id"`
	ResponseID uuid.UUID  `json:"response_id"`
	UserID     uuid.UUID  `json:"user_id"`
	Excerpt    string     `json:"excerpt"`
	Color      string     `json:"color"`
	Note       *string    `json:"note,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// --- Create topic ---
func (s *Store) CreateTopic(ctx context.Context, userID uuid.UUID, title, description string, tags []string, meta any) (Topic, error) {
	var out Topic

	tagsB, _ := json.Marshal(tags)
	metaB, _ := json.Marshal(meta)

	err := s.Pool.QueryRow(ctx, `
		INSERT INTO topics (user_id, title, description, tags, meta)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, user_id, title, description, tags, meta, canonical_response_id, created_at, updated_at
	`, userID, title, description, tagsB, metaB).
		Scan(&out.ID, &out.UserID, &out.Title, &out.Description, &tagsB, &metaB, &out.CanonicalResponseID, &out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		return out, err
	}
	_ = json.Unmarshal(tagsB, &out.Tags)
	_ = json.Unmarshal(metaB, &out.Meta)
	return out, nil
}

func (s *Store) ListTopics(ctx context.Context, userID uuid.UUID, limit int, cursor string) ([]Topic, string, error) {
	offset := 0
	if cursor != "" {
		if n, err := strconv.Atoi(cursor); err == nil {
			offset = n
		}
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id, user_id, title, description, tags, meta, created_at, updated_at
		FROM topics
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT $2
		OFFSET $3
	`, userID, limit+1, offset)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var out []Topic
	for rows.Next() {
		var t Topic
		var tagsRaw, metaRaw []byte
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Description, &tagsRaw, &metaRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, "", err
		}
		_ = json.Unmarshal(tagsRaw, &t.Tags)
		_ = json.Unmarshal(metaRaw, &t.Meta)
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	nextCursor := ""
	if len(out) > limit {
		out = out[:limit]
		nextCursor = strconv.Itoa(offset + limit)
	}
	return out, nextCursor, nil
}

func (s *Store) GetTopicWithResponses(ctx context.Context, topicID uuid.UUID, limit int, cursor string) (Topic, []Response, error) {
	var t Topic
	var tagsRaw, metaRaw []byte

	if err := s.Pool.QueryRow(ctx, `
		SELECT id, user_id, title, description, tags, meta, created_at, updated_at
		FROM topics WHERE id = $1
	`, topicID).
		Scan(&t.ID, &t.UserID, &t.Title, &t.Description, &tagsRaw, &metaRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return t, nil, err
	}
	_ = json.Unmarshal(tagsRaw, &t.Tags)
	_ = json.Unmarshal(metaRaw, &t.Meta)

	offset := 0
	if cursor != "" {
		if n, err := strconv.Atoi(cursor); err == nil {
			offset = n
		}
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id, topic_id, parent_response_id, author_type, content, content_html, raw, created_at, updated_at, status
		FROM responses
		WHERE topic_id = $1
		ORDER BY created_at DESC
		LIMIT $2
		OFFSET $3
	`, topicID, limit, offset)
	if err != nil {
		return t, nil, err
	}
	defer rows.Close()

	var resps []Response
	for rows.Next() {
		var r Response
		var rawRaw []byte
		if err := rows.Scan(&r.ID, &r.TopicID, &r.ParentResponseID, &r.AuthorType, &r.Content, &r.ContentHTML, &rawRaw, &r.CreatedAt, &r.UpdatedAt, &r.Status); err != nil {
			return t, nil, err
		}
		_ = json.Unmarshal(rawRaw, &r.Raw)
		resps = append(resps, r)
	}
	if err := rows.Err(); err != nil {
		return t, nil, err
	}
	return t, resps, nil
}

func (s *Store) UpdateTopic(ctx context.Context, id uuid.UUID, title, description *string, tags []string, canonicalResponseID *uuid.UUID) error {
	parts := []string{}
	args := []any{}
	idx := 1

	if title != nil {
		parts = append(parts, "title=$"+strconv.Itoa(idx))
		args = append(args, *title)
		idx++
	}
	if description != nil {
		parts = append(parts, "description=$"+strconv.Itoa(idx))
		args = append(args, *description)
		idx++
	}
	if tags != nil {
		tagsB, _ := json.Marshal(tags)
		parts = append(parts, "tags=$"+strconv.Itoa(idx))
		args = append(args, tagsB)
		idx++
	}
	if canonicalResponseID != nil {
		parts = append(parts, "canonical_response_id=$"+strconv.Itoa(idx))
		args = append(args, *canonicalResponseID)
		idx++
	}

	if len(parts) == 0 {
		return nil
	}

	query := "UPDATE topics SET " + strings.Join(parts, ", ") + ", updated_at=now() WHERE id=$" + strconv.Itoa(idx)
	args = append(args, id)

	_, err := s.Pool.Exec(ctx, query, args...)
	return err
}

// --- Create response ---
func (s *Store) CreateResponse(
	ctx context.Context,
	topicID uuid.UUID,
	parentResponseID *uuid.UUID,
	authorType, content, contentHTML string,
	raw map[string]any,
) (Response, error) {
	var out Response
	rawB, _ := json.Marshal(raw)

	err := s.Pool.QueryRow(ctx, `
		INSERT INTO responses (topic_id, parent_response_id, author_type, content, content_html, raw)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, topic_id, parent_response_id, author_type, content, content_html, raw, created_at, updated_at, status
	`,
		topicID, parentResponseID, authorType, content, contentHTML, rawB,
	).Scan(
		&out.ID,
		&out.TopicID,
		&out.ParentResponseID,
		&out.AuthorType,
		&out.Content,
		&out.ContentHTML,
		&out.Raw,
		&out.CreatedAt,
		&out.UpdatedAt,
		&out.Status,
	)

	return out, err
}


func (s *Store) GetResponse(ctx context.Context, id uuid.UUID) (Response, error) {
	var r Response
	err := s.Pool.QueryRow(ctx, `
		SELECT id, topic_id, parent_response_id, author_type, content, content_html, raw, created_at, updated_at, status
		FROM responses
		WHERE id=$1
	`, id).Scan(
		&r.ID,
		&r.TopicID,
		&r.ParentResponseID,
		&r.AuthorType,
		&r.Content,
		&r.ContentHTML,
		&r.Raw,
		&r.CreatedAt,
		&r.UpdatedAt,
		&r.Status,
	)
	return r, err
}


func (s *Store) ListResponsesByTopic(ctx context.Context, topicID uuid.UUID, limit int, cursor time.Time) ([]Response, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, topic_id, parent_response_id, author_type, content, content_html, raw, created_at, updated_at, status
		FROM responses
		WHERE topic_id=$1 AND created_at < $2
		ORDER BY created_at DESC
		LIMIT $3
	`, topicID, cursor, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Response
	for rows.Next() {
		var r Response
		if err := rows.Scan(
			&r.ID,
			&r.TopicID,
			&r.ParentResponseID,
			&r.AuthorType,
			&r.Content,
			&r.ContentHTML,
			&r.Raw,
			&r.CreatedAt,
			&r.UpdatedAt,
			&r.Status,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}


func (s *Store) UpdateResponse(ctx context.Context, id uuid.UUID, content, contentHTML string, raw map[string]any) error {
	rawB, _ := json.Marshal(raw)

	_, err := s.Pool.Exec(ctx, `
		UPDATE responses
		SET content=$2,
		    content_html=$3,
		    raw=$4,
		    status='complete',
		    updated_at=now()
		WHERE id=$1
	`, id, content, contentHTML, rawB)
	return err
}

func (s *Store) FailResponse(ctx context.Context, id uuid.UUID, errMsg string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE responses
		SET content=$2,
		    content_html=$2,
		    raw=jsonb_build_object('error', $3),
		    status='failed',
		    updated_at=now()
		WHERE id=$1
	`, id, "⚠️ Failed to generate response", errMsg)
	return err
}


func (s *Store) ListResponseVersions(ctx context.Context, responseID uuid.UUID, limit int) ([]ResponseVersion, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, response_id, version_number, content, content_html, raw, created_at
		FROM response_versions
		WHERE response_id=$1
		ORDER BY version_number DESC
		LIMIT $2
	`, responseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ResponseVersion
	for rows.Next() {
		var rv ResponseVersion
		var rawRaw []byte
		if err := rows.Scan(&rv.ID, &rv.ResponseID, &rv.VersionNum, &rv.Content, &rv.ContentHTML, &rawRaw, &rv.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(rawRaw, &rv.Raw)
		out = append(out, rv)
	}
	return out, rows.Err()
}

func (s *Store) GetResponseVersion(ctx context.Context, id uuid.UUID) (ResponseVersion, error) {
	var rv ResponseVersion
	var rawRaw []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT id, response_id, version_number, content, content_html, raw, created_at
		FROM response_versions WHERE id=$1
	`, id).
		Scan(&rv.ID, &rv.ResponseID, &rv.VersionNum, &rv.Content, &rv.ContentHTML, &rawRaw, &rv.CreatedAt)
	if err != nil {
		return rv, err
	}
	_ = json.Unmarshal(rawRaw, &rv.Raw)
	return rv, nil
}


func (s *Store) ListHighlightsByTopic(ctx context.Context, topicID uuid.UUID) ([]Highlight, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, topic_id, response_id, user_id, excerpt, color, note, created_at, updated_at
		FROM highlights
		WHERE topic_id=$1
		ORDER BY created_at DESC
	`, topicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Highlight
	for rows.Next() {
		var h Highlight
		if err := rows.Scan(&h.ID, &h.TopicID, &h.ResponseID, &h.UserID,
			&h.Excerpt, &h.Color, &h.Note, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *Store) CreateHighlight(ctx context.Context, topicID, responseID, userID uuid.UUID, excerpt, color string, note *string) (Highlight, error) {
	var h Highlight
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO highlights (topic_id, response_id, user_id, excerpt, color, note)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, topic_id, response_id, user_id, excerpt, color, note, created_at, updated_at
	`, topicID, responseID, userID, excerpt, color, note).
		Scan(&h.ID, &h.TopicID, &h.ResponseID, &h.UserID, &h.Excerpt, &h.Color, &h.Note, &h.CreatedAt, &h.UpdatedAt)
	return h, err
}

func (s *Store) UpdateHighlight(ctx context.Context, id uuid.UUID, color string, note *string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE highlights
		SET color=$2, note=$3, updated_at=now()
		WHERE id=$1
	`, id, color, note)
	return err
}

func (s *Store) DeleteHighlight(ctx context.Context, id uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM highlights WHERE id=$1`, id)
	return err
}
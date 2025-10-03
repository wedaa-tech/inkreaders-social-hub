package db

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool *pgxpool.Pool
}

// db.go — modify Open
func Open(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}

	// Decide which schema to use (default "app")
	schema := os.Getenv("DB_SCHEMA")
	if schema == "" {
		schema = "app"
	}

	// Set the search_path for this connection pool so unqualified table names
	// resolve to schema, then public.
	// This affects all subsequent queries on connections from the pool.
	if _, err := pool.Exec(ctx, "SET search_path TO "+schema+", public"); err != nil {
		// Close pool on failure to avoid leaking resources
		pool.Close()
		return nil, err
	}

	return &Store{Pool: pool}, nil
}


func (s *Store) Close() { s.Pool.Close() }

func (s *Store) UpsertBook(ctx context.Context, title string, authors []string, isbn10, isbn13, link string) (int64, error) {
	var id int64
	// prefer isbn13 as a unique key if present
	if isbn13 != "" {
		err := s.Pool.QueryRow(ctx, `
			INSERT INTO app.books (title, authors, isbn10, isbn13, link)
			VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (isbn13) DO UPDATE SET
				title = EXCLUDED.title,
				authors = EXCLUDED.authors,
				isbn10 = EXCLUDED.isbn10,
				link = EXCLUDED.link
			RETURNING id
		`, title, authors, isbn10, isbn13, link).Scan(&id)
		return id, err
	}

	// no isbn13: try to find by (title,authors) first
	err := s.Pool.QueryRow(ctx, `
		SELECT id FROM app.books WHERE title=$1 AND authors=$2 LIMIT 1
	`, title, authors).Scan(&id)
	if err == nil {
		return id, nil
	}

	// insert new row
	err = s.Pool.QueryRow(ctx, `
		INSERT INTO app.books (title, authors, isbn10, link)
		VALUES ($1,$2,$3,$4)
		RETURNING id
	`, title, authors, isbn10, link).Scan(&id)
	return id, err
}

func (s *Store) UpsertBookPost(ctx context.Context, uri, cid, did string, createdAt time.Time, text string,
	bookID *int64, rating, progress *float64) error {

	_, err := s.Pool.Exec(ctx, `
		INSERT INTO app.posts (uri, cid, did, collection, created_at, text, rating, progress, book_id)
		VALUES ($1,$2,$3,'com.inkreaders.book.post',$4,$5,$6,$7,$8)
		ON CONFLICT (uri) DO UPDATE SET
			cid=$2, did=$3, created_at=$4, text=$5, rating=$6, progress=$7, book_id=$8
	`, uri, cid, did, createdAt, text, rating, progress, bookID)
	return err
}

func (s *Store) UpsertArticlePost(ctx context.Context, uri, cid, did string, createdAt time.Time, text, url, title, source string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO app.posts (uri, cid, did, collection, created_at, text, article_url, article_title, article_source)
		VALUES ($1,$2,$3,'com.inkreaders.article.post',$4,$5,$6,$7,$8)
		ON CONFLICT (uri) DO UPDATE SET
			cid=$2, did=$3, created_at=$4, text=$5, article_url=$6, article_title=$7, article_source=$8
	`, uri, cid, did, createdAt, text, url, title, source)
	return err
}

func (s *Store) GetCursor(ctx context.Context, name string) (string, error) {
	var v string
	err := s.Pool.QueryRow(ctx, `SELECT value FROM app.cursors WHERE name=$1`, name).Scan(&v)
	return v, err
}

func (s *Store) SetCursor(ctx context.Context, name, value string) error {
	ct, err := s.Pool.Exec(ctx, `
		UPDATE cursors SET value=$2 WHERE name=$1
	`, name, value)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return errors.New("cursor row missing")
	}
	return nil
}

// Simple trending: count book posts last 24h, group by book
type TrendingBook struct {
	BookID  int64
	Title   string
	Authors []string
	Link    *string
	Count   int64
}

func (s *Store) TrendingBooksLast24h(ctx context.Context, limit int32) ([]TrendingBook, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT b.id, b.title, b.authors, b.link, COUNT(*) AS cnt
		FROM app.posts p
		JOIN app.books b ON p.book_id = b.id
		WHERE p.collection = 'com.inkreaders.book.post'
		  AND p.created_at >= NOW() - INTERVAL '24 hours'
		GROUP BY b.id, b.title, b.authors, b.link
		ORDER BY cnt DESC, b.title ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TrendingBook
	for rows.Next() {
		var t TrendingBook
		if err := rows.Scan(&t.BookID, &t.Title, &t.Authors, &t.Link, &t.Count); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// SessionRow represents a row from the sessions table
type SessionRow struct {
	SessionToken string
	UserID       string
	ExpiresAt    time.Time
}

// GetAllSessions returns all non-expired sessions
func (s *Store) GetAllSessions(ctx context.Context) ([]SessionRow, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT session_token, user_id, expires_at
		FROM app.sessions
		WHERE expires_at > NOW()
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SessionRow
	for rows.Next() {
		var sr SessionRow
		if err := rows.Scan(&sr.SessionToken, &sr.UserID, &sr.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, sr)
	}
	return out, rows.Err()
}


// AccountRow represents account + session info
type AccountRow struct {
	UserID            string
	Provider          string
	ProviderAccountID string
	AccessTokenEnc    string
	RefreshTokenEnc   string
	ExpiresAt         time.Time
}

// GetAllSessionsWithAccounts returns all active accounts for users with sessions
func (s *Store) GetAllSessionsWithAccounts(ctx context.Context) ([]AccountRow, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT a.user_id, a.provider, a.provider_account_id, a.access_token, a.refresh_token, a.expires_at
		FROM app.sessions s
		JOIN app.accounts a ON a.user_id = s.user_id
		WHERE s.expires_at > NOW()
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AccountRow
	for rows.Next() {
		var ar AccountRow
		if err := rows.Scan(&ar.UserID, &ar.Provider, &ar.ProviderAccountID,
			&ar.AccessTokenEnc, &ar.RefreshTokenEnc, &ar.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, ar)
	}
	return out, rows.Err()
}

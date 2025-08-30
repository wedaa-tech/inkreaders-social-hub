package http

import (
    "context"
    "os"
    "path/filepath"
)

// Local storage that saves files under ./data/uploads
type LocalStorage struct {
    base string
}

func NewLocalStorage(base string) *LocalStorage {
    _ = os.MkdirAll(base, 0755)
    return &LocalStorage{base: base}
}

func (s *LocalStorage) Put(ctx context.Context, key string, blob []byte) string {
    path := filepath.Join(s.base, key)
    _ = os.MkdirAll(filepath.Dir(path), 0755)
    _ = os.WriteFile(path, blob, 0644)
    return key
}

func (s *LocalStorage) Read(ctx context.Context, key string) ([]byte, error) {
    path := filepath.Join(s.base, key)
    return os.ReadFile(path)
}

// Extractor stub — just treats everything as plain text
type SimpleExtractor struct{}

func NewExtractor() *SimpleExtractor {
    return &SimpleExtractor{}
}

func (e *SimpleExtractor) PlainText(mime string, blob []byte) string {
    return string(blob) // naive fallback
}

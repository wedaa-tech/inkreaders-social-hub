// internal/http/helpers_files.go
package http

import (
	"bytes"
	"net/http"
	"strings"
)

// DetectMIME – naive MIME detection from filename or content
func DetectMIME(filename string, data []byte) string {
	if strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		return "application/pdf"
	}
	if strings.HasSuffix(strings.ToLower(filename), ".txt") {
		return "text/plain"
	}
	// Fallback
	return http.DetectContentType(data)
}

// countPages – dummy PDF/text page counter (replace with real later)
func countPages(mime string, data []byte) int {
	if mime == "application/pdf" {
		// naive: count "%Page" markers
		return bytes.Count(data, []byte("/Page"))
	}
	return 1
}

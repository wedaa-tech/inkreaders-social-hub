package http

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func (h *Handlers) TrendingBooks(w http.ResponseWriter, r *http.Request) {
	limit := int32(20)
	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}
	items, err := h.Store.TrendingBooksLast24h(r.Context(), limit)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	type outItem struct {
		BookID  int64    `json:"bookId"`
		Title   string   `json:"title"`
		Authors []string `json:"authors"`
		Link    *string  `json:"link,omitempty"`
		Count   int64    `json:"count"`
	}
	resp := make([]outItem, 0, len(items))
	for _, it := range items {
		resp = append(resp, outItem{
			BookID: it.BookID, Title: it.Title, Authors: it.Authors, Link: it.Link, Count: it.Count,
		})
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": resp})
}

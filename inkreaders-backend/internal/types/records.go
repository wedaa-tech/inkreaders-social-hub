package types

type PostBookIn struct {
	Text     string   `json:"text"`
	Book     BookIn   `json:"book"`
	Rating   *float64 `json:"rating,omitempty"`
	Progress *float64 `json:"progress,omitempty"`
}

type BookIn struct {
	Title   string   `json:"title"`
	Authors []string `json:"authors,omitempty"`
	ISBN10  string   `json:"isbn10,omitempty"`
	ISBN13  string   `json:"isbn13,omitempty"`
	Link    string   `json:"link,omitempty"`
}

type PostArticleIn struct {
	Text    string    `json:"text"`
	Article ArticleIn `json:"article"`
}

type ArticleIn struct {
	Title  string `json:"title"`
	URL    string `json:"url"`
	Source string `json:"source,omitempty"`
}

// app/components/feed/Composer.tsx
"use client";
import { useState } from "react";
import Card from "@/app/components/ui/Card";

export default function Composer({ onPost }: {
  onPost: (p: any) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"note" | "book" | "article">("note");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");

  function handleSubmit() {
    if (mode === "note" && !text.trim()) return;
    if (mode === "book" && !bookTitle.trim()) return;
    if (mode === "article" && !articleTitle.trim()) return;

    onPost({
      author: { handle: "@you", name: "You" },
      kind: mode,
      text: mode === "note" ? text.trim() : undefined,
      book: mode === "book" ? { title: bookTitle.trim(), author: bookAuthor.trim() } : undefined,
      article: mode === "article" ? { title: articleTitle.trim(), source: articleSource.trim() } : undefined,
    });

    setText(""); setBookTitle(""); setBookAuthor(""); setArticleTitle(""); setArticleSource("");
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
        <div className="w-full">
          <div className="flex items-center gap-2">
            {(["note", "book", "article"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                type="button"
                className={"rounded-lg px-3 py-1 text-sm " +
                  (mode === m
                    ? "bg-[color:var(--color-brand)] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
                {m === "note" ? "Post" : m === "book" ? "Book" : "Article"}
              </button>
            ))}
          </div>

          {mode === "note" && (
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Share a thought about what you're reading..."
              className="mt-3 w-full resize-y rounded-xl border border-gray-300 p-3
                         focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              rows={3} />
          )}

          {mode === "book" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Book title" className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
              <input value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)}
                placeholder="Author" className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
            </div>
          )}

          {mode === "article" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Article title" className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
              <input value={articleSource} onChange={(e) => setArticleSource(e.target.value)}
                placeholder="Source / URL" className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">AT Protocol ready</span>
            <button onClick={handleSubmit}
              className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white hover:opacity-90"
              type="button">
              Post
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

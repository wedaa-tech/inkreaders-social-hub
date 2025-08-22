// app/components/FeedClient.tsx
"use client";

import { useMemo, useState, useEffect } from "react"; // CHANGED: added useEffect

type Post = {
  id: string;
  author: { handle: string; name: string };
  avatar?: string;
  kind: "note" | "book" | "article";
  text?: string;
  book?: { title: string; author: string };
  article?: { title: string; source: string };
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
};

function Composer({
  onPost,
}: {
  onPost: (p: Omit<Post, "id" | "createdAt" | "likes" | "reposts" | "replies">) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"note" | "book" | "article">("note");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");

  return (
    <div id="compose" className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
        <div className="w-full">
          <div className="flex items-center gap-2">
            {(["note", "book", "article"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={
                  "rounded-lg px-3 py-1 text-sm " +
                  (mode === m
                    ? "bg-[color:var(--color-brand)] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                }
                type="button"
              >
                {m === "note" ? "Post" : m === "book" ? "Book" : "Article"}
              </button>
            ))}
          </div>

          {mode === "note" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share a thought about what you're reading..."
              className="mt-3 w-full resize-y rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              rows={3}
            />
          )}

          {mode === "book" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Book title"
                className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              />
              <input
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                placeholder="Author"
                className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              />
            </div>
          )}

          {mode === "article" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Article title"
                className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              />
              <input
                value={articleSource}
                onChange={(e) => setArticleSource(e.target.value)}
                placeholder="Source / URL"
                className="rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">AT Protocol ready</span> {/* CHANGED: copy */}
            <button
              onClick={() => {
                if (mode === "note" && !text.trim()) return;
                if (mode === "book" && !bookTitle.trim()) return;
                if (mode === "article" && !articleTitle.trim()) return;

                onPost({
                  author: { handle: "@you", name: "You" },
                  kind: mode,
                  text: mode === "note" ? text.trim() : undefined,
                  book:
                    mode === "book"
                      ? { title: bookTitle.trim(), author: bookAuthor.trim() }
                      : undefined,
                  article:
                    mode === "article"
                      ? { title: articleTitle.trim(), source: articleSource.trim() }
                      : undefined,
                  avatar: undefined,
                });

                // reset
                setText("");
                setBookTitle("");
                setBookAuthor("");
                setArticleTitle("");
                setArticleSource("");
              }}
              className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white hover:opacity-90"
              type="button"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{post.author.name}</span>
            <span className="truncate text-sm text-gray-500">{post.author.handle}</span>
            <span className="text-sm text-gray-400">
              · {new Date(post.createdAt).toLocaleTimeString()}
            </span>
          </div>

          {post.kind === "note" && <p className="mt-2 whitespace-pre-wrap">{post.text}</p>}

          {post.kind === "book" && (
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm text-gray-500">Book</div>
              <div className="text-lg font-semibold">{post.book?.title}</div>
              {post.book?.author && <div className="text-sm text-gray-600">by {post.book.author}</div>}
              {post.text && <p className="mt-2">{post.text}</p>}
            </div>
          )}

          {post.kind === "article" && (
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm text-gray-500">Article</div>
              <div className="text-lg font-semibold">{post.article?.title}</div>
              {post.article?.source && (
                <a
                  href={post.article.source}
                  className="text-sm text-[color:var(--color-brand)] hover:underline break-words"
                >
                  {post.article.source}
                </a>
              )}
              {post.text && <p className="mt-2">{post.text}</p>}
            </div>
          )}

          <div className="mt-3 flex gap-6 text-sm text-gray-500">
            <button className="hover:text-gray-700" type="button">
              💬 {post.replies}
            </button>
            <button className="hover:text-gray-700" type="button">
              🔁 {post.reposts}
            </button>
            <button className="hover:text-gray-700" type="button">
              ❤️ {post.likes}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedClient() {
  // CHANGED: remove hard-coded initial; we’ll fetch from /api/bsky/timeline
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true); // CHANGED
  const [error, setError] = useState<string | null>(null); // CHANGED

  // CHANGED: map ATProto timeline JSON -> our Post[]
  function mapTimelineToPosts(data: any): Post[] {
    const feed = Array.isArray(data?.feed) ? data.feed : [];
    return feed.map((item: any): Post => {
      const record = item?.post?.record ?? {};
      const author = item?.post?.author ?? {};
      const text = record?.text ?? "";
      const createdAt = record?.createdAt ?? item?.post?.indexedAt ?? new Date().toISOString();

      return {
        id: item?.post?.uri ?? crypto.randomUUID(),
        author: {
          handle: author?.handle ? `@${author.handle}` : "@unknown",
          name: author?.displayName ?? author?.handle ?? "Unknown",
        },
        kind: "note", // timeline items are plain posts; advanced kinds can be inferred later
        text,
        createdAt,
        likes: item?.post?.likeCount ?? 0,
        reposts: item?.post?.repostCount ?? 0,
        replies: item?.post?.replyCount ?? 0,
      };
    });
  }

  // CHANGED: fetch timeline from server
  async function loadTimeline() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/bsky/timeline?limit=30", { cache: "no-store" });
      if (!res.ok) throw new Error(`Timeline error ${res.status}`);
      const data = await res.json();
      setPosts(mapTimelineToPosts(data));
      // (Optional) you can keep the cursor from data.next for pagination later
    } catch (e: any) {
      setError(e?.message ?? "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }

  // CHANGED: call once on mount
  useEffect(() => {
    loadTimeline();
  }, []);

  // CHANGED: post to server -> create on ATProto -> refresh timeline
  async function handlePost(p: Omit<Post, "id" | "createdAt" | "likes" | "reposts" | "replies">) {
    // We turn book/article into a text payload for now.
    let payloadText = p.text ?? "";
    if (p.kind === "book" && p.book) {
      await fetch("http://localhost:8080/api/ink/post-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: p.text ?? "",
          book: {
            title: p.book.title,
            authors: p.book.author ? [p.book.author] : [],
            link: p.article?.source ?? ""
          }
        }),
      });
      await loadTimeline(); // keep showing home feed; later we’ll add a custom feed
      return;
    }
    if (p.kind === "article" && p.article) {
      await fetch("http://localhost:8080/api/ink/post-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: p.text ?? "",
          article: {
            title: p.article.title,
            url: p.article.source || "",   // in your UI 'source' holds URL today
            source: ""                     // optional human label
          }
        }),
      });
      await loadTimeline();
      return;
    }

    try {
      const res = await fetch("/api/bsky/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payloadText }),
      });
      if (!res.ok) throw new Error(`Post failed ${res.status}`);
      await loadTimeline(); // refresh from source of truth
    } catch (e) {
      console.error(e);
      // (Optional) show a toast/snackbar; for now we no-op
    }
  }

  return (
    <div className="space-y-4">
      <Composer onPost={handlePost} /> {/* CHANGED: now uses server-backed submit */}
      {loading && <div className="rounded-2xl border border-gray-200 bg-white p-4">Loading…</div>}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={loadTimeline} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

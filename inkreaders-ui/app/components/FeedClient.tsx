// app/components/FeedClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Post = {
  id: string;
  uri?: string;
  cid?: string;
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
            <span className="text-sm text-gray-500">AT Protocol ready</span>
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
  const { push } = useToast();
  const [likeCount, setLikeCount] = useState(post.likes);
  const [repostCount, setRepostCount] = useState(post.reposts);
  const [replyCount, setReplyCount] = useState(post.replies);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [replySending, setReplySending] = useState(false);

  // ask backend for latest counts for this specific post
  async function refreshCounts(delayMs = 400) {
    if (!post.uri) return;
    // slight delay to let the network propagation / indexing settle
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const r = await fetch(
        `${API_BASE}/api/bsky/post-stats?uri=${encodeURIComponent(post.uri)}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!r.ok) return; // silent
      const j = await r.json();
      if (typeof j.likes === "number") setLikeCount(j.likes);
      if (typeof j.reposts === "number") setRepostCount(j.reposts);
      if (typeof j.replies === "number") setReplyCount(j.replies);
    } catch {
      // ignore; keep optimistic values
    }
  }

  async function like() {
    if (!post.uri || !post.cid || liking) return;
    setLiking(true);
    setLikeCount((c) => c + 1); // optimistic
    try {
      await fetchJson(`${API_BASE}/api/bsky/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: post.uri, cid: post.cid }),
      });
      push({ variant: "success", message: "Liked ❤️" });
      refreshCounts(); // inline refresh
    } catch (e: any) {
      setLikeCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Like failed", message: e?.message ?? "Try again" });
    } finally {
      setLiking(false);
    }
  }

  async function repost() {
    if (!post.uri || !post.cid || reposting) return;
    setReposting(true);
    setRepostCount((c) => c + 1);
    try {
      await fetchJson(`${API_BASE}/api/bsky/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: post.uri, cid: post.cid }),
      });
      push({ variant: "success", message: "Reposted 🔁" });
      refreshCounts();
    } catch (e: any) {
      setRepostCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Repost failed", message: e?.message ?? "Try again" });
    } finally {
      setReposting(false);
    }
  }

  async function sendReply() {
    const t = replyText.trim();
    if (!t || !post.uri || !post.cid || replySending) return;
    setReplySending(true);
    setReplyText("");
    setReplying(false);
    setReplyCount((c) => c + 1);
    try {
      await fetchJson(`${API_BASE}/api/bsky/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentUri: post.uri, parentCid: post.cid, text: t }),
      });
      push({ variant: "success", message: "Replied 💬" });
      refreshCounts();
    } catch (e: any) {
      setReplyCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Reply failed", message: e?.message ?? "Try again" });
    } finally {
      setReplySending(false);
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{post.author.name}</span>
            <span className="truncate text-sm text-gray-500">{post.author.handle}</span>
            <span className="text-sm text-gray-400">· {new Date(post.createdAt).toLocaleTimeString()}</span>
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
                  className="break-words text-sm text-[color:var(--color-brand)] hover:underline"
                >
                  {post.article.source}
                </a>
              )}
              {post.text && <p className="mt-2">{post.text}</p>}
            </div>
          )}

          <div className="mt-3 flex gap-6 text-sm text-gray-500">
            <button onClick={() => setReplying((s) => !s)} className="hover:text-gray-700" type="button">
              💬 {replyCount}
            </button>
            <button
              onClick={repost}
              className={"hover:text-gray-700 " + (!post.uri ? "cursor-not-allowed opacity-40" : "")}
              type="button"
              disabled={!post.uri || reposting}
              title={!post.uri ? "No URI" : reposting ? "Reposting..." : "Repost"}
            >
              🔁 {repostCount}
            </button>
            <button
              onClick={like}
              className={"hover:text-gray-700 " + (!post.uri ? "cursor-not-allowed opacity-40" : "")}
              type="button"
              disabled={!post.uri || liking}
              title={!post.uri ? "No URI" : liking ? "Liking..." : "Like"}
            >
              ❤️ {likeCount}
            </button>
          </div>

          {replying && (
            <div className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                placeholder="Reply..."
                className="w-full rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
              />
              <div className="mt-1 flex justify-end gap-2">
                <button onClick={() => setReplying(false)} className="rounded-lg px-3 py-1 text-sm">
                  Cancel
                </button>
                <button
                  onClick={sendReply}
                  className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1 text-sm text-white disabled:opacity-60"
                  disabled={replySending}
                >
                  {replySending ? "Sending…" : "Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function FeedClient() {
  const { push } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function mapTimelineToPosts(data: any): Post[] {
    const feed = Array.isArray(data?.feed) ? data.feed : [];
    
    return feed.map((item: any): Post => {
      const record = item?.post?.record ?? {};
      const author = item?.post?.author ?? {};
      const text = record?.text ?? "";
      const createdAt = record?.createdAt ?? item?.post?.indexedAt ?? new Date().toISOString();
      const uri = item?.post?.uri as string | undefined;
      const cid = item?.post?.cid as string | undefined;
      const id = uri && cid ? `${uri}#${cid}` : uri ?? crypto.randomUUID();

      return {
        id,
        uri,
        cid,
        author: {
          handle: author?.handle ? `@${author.handle}` : "@unknown",
          name: author?.displayName ?? author?.handle ?? "Unknown",
        },
        kind: "note",
        text,
        createdAt,
        likes: item?.post?.likeCount ?? 0,
        reposts: item?.post?.repostCount ?? 0,
        replies: item?.post?.replyCount ?? 0,
      };
    });
  }

  async function loadTimeline() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/bsky/timeline?limit=30", { cache: "no-store" });
      if (!res.ok) throw new Error(`Timeline error ${res.status}`);
      const data = await res.json();

      const mapped = mapTimelineToPosts(data);
      // de-dupe the freshly mapped list (not the stale state)
      const uniq = Array.from(new Map(mapped.map((p) => [p.id, p])).values());
      setPosts(uniq);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadTimeline();
  }, []);

  async function handlePost(p: Omit<Post, "id" | "createdAt" | "likes" | "reposts" | "replies">) {
    try {
      if (p.kind === "book" && p.book) {
        await fetchJson(`${API_BASE}/api/ink/post-book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: p.text ?? "",
            book: {
              title: p.book.title,
              authors: p.book.author ? [p.book.author] : [],
            },
          }),
        });
        push({ variant: "success", message: "Book posted 📚" });
        await loadTimeline();
        return;
      }

      if (p.kind === "article" && p.article) {
        await fetchJson(`${API_BASE}/api/ink/post-article`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: p.text ?? "",
            article: {
              title: p.article.title,
              url: p.article.source || "",
              source: "",
            },
          }),
        });
        push({ variant: "success", message: "Article posted 📰" });
        await loadTimeline();
        return;
      }

      const payloadText = p.text ?? "";
      if (!payloadText.trim()) return;
      const res = await fetch(`/api/bsky/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payloadText }),
      });
      if (!res.ok) throw new Error(`post ${res.status}`);
      push({ variant: "success", message: "Posted ✅" });
      await loadTimeline();
    } catch (e: any) {
      console.error(e);
      push({ variant: "error", title: "Post failed", message: e?.message ?? "Try again" });
    }
  }

  return (
    <div className="space-y-4">
      <Composer onPost={handlePost} />
      {loading && <div className="rounded-2xl border border-gray-200 bg-white p-4">Loading…</div>}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={loadTimeline} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-500">
          {" "}
          Nothing here yet — follow more readers or post your first note! ✨
        </div>
      )}
        {!loading && !error && posts.length > 0 && posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

// Shared fetch helper with decent error reporting
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

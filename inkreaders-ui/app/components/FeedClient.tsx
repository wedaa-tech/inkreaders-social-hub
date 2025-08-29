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
  images?: string[];
  external?: {
    uri: string;
    title?: string;
    description?: string;
    thumb?: string;
  };
};

type FeedSource = "app" | "user";

/* ---------- helpers for embeds ---------- */
function extractImages(embed: any): string[] {
  if (!embed) return [];
  if (
    embed?.$type === "app.bsky.embed.images#view" &&
    Array.isArray(embed.images)
  ) {
    return embed.images
      .map((im: any) => im?.thumb || im?.full || "")
      .filter(Boolean);
  }
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
    return extractImages(embed.media);
  }
  return [];
}

function extractExternal(
  embed: any
):
  | { uri: string; title?: string; description?: string; thumb?: string }
  | undefined {
  if (!embed) return undefined;
  if (embed?.$type === "app.bsky.embed.external#view" && embed.external?.uri) {
    const e = embed.external;
    return {
      uri: e.uri,
      title: e.title,
      description: e.description,
      thumb: e.thumb,
    };
  }
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
    return extractExternal(embed.media);
  }
  return undefined;
}

// very simple autolink (URLs only)
function renderTextWithLinks(text?: string) {
  if (!text) return null;
  const parts = text.split(/(\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--color-brand)] hover:underline break-words"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ---------- Composer ---------- */
function Composer({
  onPost,
}: {
  onPost: (
    p: Omit<Post, "id" | "createdAt" | "likes" | "reposts" | "replies">
  ) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"note" | "book" | "article">("note");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");

  return (
    <div
      id="compose"
      className="rounded-2xl border border-gray-200 bg-white p-4"
    >
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
                      ? {
                          title: articleTitle.trim(),
                          source: articleSource.trim(),
                        }
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

/* ---------- Post card ---------- */
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
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const storageKey = post.uri ? `ir:bm:${post.uri}` : `ir:bm:${post.id}`;

  const [shelfStatus, setShelfStatus] = useState<
    "none" | "want" | "reading" | "finished"
  >("none");

  function cycleShelf() {
    setShelfStatus((prev) => {
      switch (prev) {
        case "none":
          return "want";
        case "want":
          return "reading";
        case "reading":
          return "finished";
        default:
          return "none";
      }
    });
  }
  const shelfStatusLabel =
    shelfStatus === "none"
      ? "Add"
      : shelfStatus === "want"
      ? "Want"
      : shelfStatus === "reading"
      ? "Reading"
      : "Finished";

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey) === "1";
      console.debug("[bookmark/hydrate]", { storageKey, v });
      setBookmarked(v);
    } catch (e) {
      console.warn("[bookmark/hydrate] failed", e);
    }
  }, [storageKey]);

  function persist(v: boolean) {
    try {
      v
        ? localStorage.setItem(storageKey, "1")
        : localStorage.removeItem(storageKey);
      console.debug("[bookmark/persist]", { storageKey, v });
    } catch (e) {
      console.warn("[bookmark/persist] failed", e);
    }
  }

  async function toggleBookmark() {
    if (bookmarking) return;
    setBookmarking(true);

    // optimistic local toggle
    setBookmarked((prev) => {
      const next = !prev;
      console.debug("[bookmark/optimistic]", { prev, next, uri: post.uri });
      persist(next);
      return next;
    });

    try {
      if (post.uri) {
        await fetchJson(`${API_BASE}/api/bookmarks/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postUri: post.uri }),
          credentials: "include",
        });
      } else {
        console.warn("[bookmark] no post.uri; client-only toggle");
      }
    } catch (e) {
      console.error("[bookmark/error] reverting", e);
      setBookmarked((prev) => {
        const next = !prev;
        persist(next);
        return next;
      });
    } finally {
      setBookmarking(false);
    }
  }

  async function refreshCounts(delayMs = 400) {
    if (!post.uri) return;
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      const r = await fetch(
        `${API_BASE}/api/bsky/post-stats?uri=${encodeURIComponent(
          post.uri
        )}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!r.ok) return;
      const j = await r.json();
      if (typeof j.likes === "number") setLikeCount(j.likes);
      if (typeof j.reposts === "number") setRepostCount(j.reposts);
      if (typeof j.replies === "number") setReplyCount(j.replies);
    } catch {}
  }

  async function like() {
    if (!post.uri || !post.cid || liking) return;
    setLiking(true);
    setLikeCount((c) => c + 1);
    try {
      await fetchJson(`${API_BASE}/api/bsky/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: post.uri, cid: post.cid }),
        credentials: "include",
      });
      push({ variant: "success", message: "Liked ❤️" });
      refreshCounts();
    } catch (e: any) {
      setLikeCount((c) => Math.max(0, c - 1));
      push({
        variant: "error",
        title: "Like failed",
        message: e?.message ?? "Try again",
      });
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
        credentials: "include",
      });
      push({ variant: "success", message: "Reposted 🔁" });
      refreshCounts();
    } catch (e: any) {
      setRepostCount((c) => Math.max(0, c - 1));
      push({
        variant: "error",
        title: "Repost failed",
        message: e?.message ?? "Try again",
      });
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
        body: JSON.stringify({
          parentUri: post.uri,
          parentCid: post.cid,
          text: t,
        }),
        credentials: "include",
      });
      push({ variant: "success", message: "Replied 💬" });
      refreshCounts();
    } catch (e: any) {
      setReplyCount((c) => Math.max(0, c - 1));
      push({
        variant: "error",
        title: "Reply failed",
        message: e?.message ?? "Try again",
      });
    } finally {
      setReplySending(false);
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {post.avatar ? (
          <img
            src={post.avatar}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-200" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{post.author.name}</span>
            <span className="truncate text-sm text-gray-500">
              {post.author.handle}
            </span>
            <span className="text-sm text-gray-400">
              · {new Date(post.createdAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Text (autolinked) */}
          {post.kind === "note" && (
            <p className="mt-2 whitespace-pre-wrap break-words">
              {renderTextWithLinks(post.text)}
            </p>
          )}

          {/* Book card */}
          {post.kind === "book" && (
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm text-gray-500">Book</div>
              <div className="text-lg font-semibold">{post.book?.title}</div>
              {post.book?.author && (
                <div className="text-sm text-gray-600">
                  by {post.book.author}
                </div>
              )}
              {post.text && <p className="mt-2">{post.text}</p>}
            </div>
          )}

          {/* Article card */}
          {post.kind === "article" && (
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm text-gray-500">Article</div>
              <div className="text-lg font-semibold">{post.article?.title}</div>
              {post.article?.source && (
                <a
                  href={post.article.source}
                  className="break-words text-sm text-[color:var(--color-brand)] hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {post.article?.source}
                </a>
              )}
              {post.text && <p className="mt-2">{post.text}</p>}
            </div>
          )}

          {/* Image embeds (1–4) */}
          {!!post.images?.length && (
            <div
              className={
                "mt-3 grid gap-2 " +
                (post.images.length === 1 ? "grid-cols-1" : "grid-cols-2")
              }
            >
              {post.images.slice(0, 4).map((src, idx) => (
                <img
                  key={src + idx}
                  src={src}
                  alt=""
                  className="w-full rounded-2xl object-cover shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          )}

          {/* External link card */}
          {post.external && (
            <a
              href={post.external.uri}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              <div className="flex gap-3 p-3">
                {post.external.thumb ? (
                  <img
                    src={post.external.thumb}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {post.external.title || post.external.uri}
                  </div>
                  {post.external.description && (
                    <div className="mt-0.5 line-clamp-2 text-sm text-gray-600">
                      {post.external.description}
                    </div>
                  )}
                  <div className="mt-0.5 truncate text-xs text-gray-400">
                    {post.external.uri}
                  </div>
                </div>
              </div>
            </a>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => setReplying((s) => !s)}
              title="Reply"
              aria-label="Reply"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)]"
            >
              <span aria-hidden>💬</span>
              <span className="tabular-nums">{replyCount}</span>
            </button>

            <button
              type="button"
              onClick={repost}
              disabled={!post.uri || reposting}
              title={!post.uri ? "No URI" : reposting ? "Reposting…" : "Repost"}
              aria-label="Repost"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95
               cursor-pointer disabled:cursor-not-allowed disabled:opacity-40
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)]"
            >
              <span aria-hidden>🔁</span>
              <span className="tabular-nums">{repostCount}</span>
            </button>

            <button
              type="button"
              onClick={like}
              disabled={!post.uri || liking}
              title={!post.uri ? "No URI" : liking ? "Liking…" : "Like"}
              aria-label="Like"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95
               cursor-pointer disabled:cursor-not-allowed disabled:opacity-40
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)]"
            >
              <span aria-hidden>❤️</span>
              <span className="tabular-nums">{likeCount}</span>
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              aria-pressed={bookmarked}
              disabled={bookmarking}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95
             cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)]"
            >
              <span aria-hidden>{bookmarked ? "⭐" : "☆"}</span>
              <span className="sr-only">
                {bookmarked ? "Remove bookmark" : "Bookmark"}
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={cycleShelf}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 active:scale-95 cursor-pointer"
                title="Add to shelf"
              >
                📚 <span>{shelfStatusLabel}</span>
              </button>
            </div>
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
                <button
                  onClick={() => setReplying(false)}
                  className="rounded-lg px-3 py-1 text-sm"
                >
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

/* ---------- Feed root ---------- */
export default function FeedClient() {
  console.debug("[FeedClient] mount");
  const { push } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feedSource, setFeedSource] = useState<FeedSource>("app");
  const [bsConnected, setBsConnected] = useState<boolean>(false);
  const [effectiveSource, setEffectiveSource] = useState<FeedSource>("app"); // who actually served

  function mapTimelineToPosts(data: any): Post[] {
    const feed = Array.isArray(data?.feed) ? data.feed : [];
    return feed.map((item: any): Post => {
      const record = item?.post?.record ?? {};
      const author = item?.post?.author ?? {};
      const text = record?.text ?? "";
      const createdAt =
        record?.createdAt ?? item?.post?.indexedAt ?? new Date().toISOString();
      const uri = item?.post?.uri as string | undefined;
      const cid = item?.post?.cid as string | undefined;
      const id = uri && cid ? `${uri}#${cid}` : uri ?? crypto.randomUUID();

      const embed = item?.post?.embed;
      const images = extractImages(embed);
      const external = extractExternal(embed);

      return {
        id,
        uri,
        cid,
        author: {
          handle: author?.handle ? `@${author.handle}` : "@unknown",
          name: author?.displayName ?? author?.handle ?? "Unknown",
        },
        avatar: author?.avatar || undefined,
        kind: "note",
        text,
        createdAt,
        likes: item?.post?.likeCount ?? 0,
        reposts: item?.post?.repostCount ?? 0,
        replies: item?.post?.replyCount ?? 0,
        images,
        external,
      };
    });
  }

  async function loadTimeline() {
  try {
    console.debug("Start loading timeline");
    setLoading(true);
    setError(null);

    const res = await fetch(
      `${API_BASE}/api/bsky/timeline?limit=30&source=${feedSource}`,
      { cache: "no-store", credentials: "include" }
    );
    console.debug("[timeline/resp]", res.status);

    // NEW: keep the 'user' tab selected; show banner; empty feed
    if (res.status === 401 && feedSource === "user") {
      setPosts([]);                    // show empty feed under the banner
      setError(null);                  // avoid red error box
      setEffectiveSource("user");      // “Showing: Following (You)”
      setLoading(false);
      return;                          // stop here
    }

    const servedBy = res.headers.get("X-IR-Source") as FeedSource | null;
    console.debug("[timeline/header]", servedBy);
    if (servedBy === "app" || servedBy === "user") {
      setEffectiveSource(servedBy);
    }

    if (!res.ok) throw new Error(`Timeline error ${res.status}`);

    const data = await res.json();
    const mapped = mapTimelineToPosts(data);
    const uniq = Array.from(new Map(mapped.map((p) => [p.id, p])).values());
    setPosts(uniq);
  } catch (e: any) {
    setError(e?.message ?? "Failed to load timeline");
  } finally {
    setLoading(false);
  }
}


  // Check Bluesky connection in the browser
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        if (!alive) return;
        setBsConnected(res.ok);
      } catch {
        if (alive) setBsConnected(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load when feedSource changes
  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedSource]);

  async function handlePost(
    p: Omit<Post, "id" | "createdAt" | "likes" | "reposts" | "replies">
  ) {
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
          credentials: "include",
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
          credentials: "include",
        });
        push({ variant: "success", message: "Article posted 📰" });
        await loadTimeline();
        return;
      }

      const payloadText = p.text ?? "";
      if (!payloadText.trim()) return;
      const res = await fetch(`${API_BASE}/api/bsky/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payloadText }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`post ${res.status}`);
      push({ variant: "success", message: "Posted ✅" });
      await loadTimeline();
    } catch (e: any) {
      console.error(e);
      push({
        variant: "error",
        title: "Post failed",
        message: e?.message ?? "Try again",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Composer onPost={handlePost} />

      {/* Feed tabs */}
      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFeedSource("app")}
            className={
              "rounded-xl px-3 py-1 text-sm " +
              (feedSource === "app"
                ? "bg-[color:var(--color-brand)] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            For You
          </button>

          <button
            type="button"
            onClick={() => setFeedSource("user")}
            className={
              "rounded-xl px-3 py-1 text-sm " +
              (feedSource === "user"
                ? "bg-[color:var(--color-brand)] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
            title={bsConnected ? "Your following" : "Connect Bluesky to enable"}
          >
            Following (You)
          </button>

          <div className="ml-auto text-xs text-gray-500 px-2">
            Showing:{" "}
            <span className="font-medium">
              {effectiveSource === "user" ? "Following (You)" : "For You"}
            </span>
          </div>
        </div>
      </div>
      {!bsConnected && feedSource === "user" && (
        <div className="ml-auto text-sm text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
          Connect Bluesky to see your following feed.{" "}
          <a className="underline" href="/settings">
            Connect now
          </a>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          Loading…
        </div>
      )}
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
      {!loading &&
        !error &&
        posts.length > 0 &&
        posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

/* ---------- shared fetch helper ---------- */
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  console.debug("[fetchJson]", {
    url,
    method: init?.method ?? "GET",
    status: res.status,
    ok: res.ok,
    bodyPreview: text.slice(0, 200),
  });
  if (!res.ok) {
    // Special-case: allow client-only bookmarks if route isn't wired yet
    if (url.includes("/api/bookmarks/toggle") && res.status === 404) {
      console.warn("[bookmarks] 404 route missing; proceeding client-only.");
      return {};
    }
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

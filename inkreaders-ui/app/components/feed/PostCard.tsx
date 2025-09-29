// app/components/feed/PostCard.tsx
"use client";

import { useEffect, useState } from "react";
import Card from "@/app/components/ui/Card";
import { useToast } from "../util/ToastProvider";
import { renderTextWithLinks } from "./helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function PostCard({ post }: { post: any }) {
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

  /* ---------- Shelf cycle ---------- */
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

  /* ---------- bookmark hydration ---------- */
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey) === "1";
      setBookmarked(v);
    } catch {}
  }, [storageKey]);

  function persist(v: boolean) {
    try {
      v
        ? localStorage.setItem(storageKey, "1")
        : localStorage.removeItem(storageKey);
    } catch {}
  }

  async function toggleBookmark() {
    if (bookmarking) return;
    setBookmarking(true);
    setBookmarked((prev) => {
      const next = !prev;
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
      }
    } catch {
      setBookmarked((prev) => {
        const next = !prev;
        persist(next);
        return next;
      });
    } finally {
      setBookmarking(false);
    }
  }

  /* ---------- refresh counts ---------- */
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

  /* ---------- like/repost/reply ---------- */
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
    } catch {
      setLikeCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Like failed", message: "Try again" });
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
    } catch {
      setRepostCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Repost failed", message: "Try again" });
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
    } catch {
      setReplyCount((c) => Math.max(0, c - 1));
      push({ variant: "error", title: "Reply failed", message: "Try again" });
    } finally {
      setReplySending(false);
    }
  }

  /* ---------- render ---------- */
  return (
    <Card className="p-4">
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
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-semibold">{post.author.name}</span>
            <span className="truncate text-sm text-gray-500">
              {post.author.handle}
            </span>
            <span className="text-sm text-gray-400">
              · {timeAgo(post.createdAt)}
            </span>
          </div>

          {/* Content */}
          {post.kind === "note" && (
            <p className="mt-2 whitespace-pre-wrap break-words">
              {renderTextWithLinks(post.text)}
            </p>
          )}

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

          {/* Image embeds */}
          {!!post.images?.length && (
            <div
              className={
                "mt-3 grid gap-2 " +
                (post.images.length === 1 ? "grid-cols-1" : "grid-cols-2")
              }
            >
              {post.images.slice(0, 4).map((src: string, idx: number) => (
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

          {/* External link preview */}
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
              onClick={() => setReplying((s) => !s)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100"
            >
              💬 <span className="tabular-nums">{replyCount}</span>
            </button>
            <button
              onClick={repost}
              disabled={reposting}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100"
            >
              🔁 <span className="tabular-nums">{repostCount}</span>
            </button>
            <button
              onClick={like}
              disabled={liking}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100"
            >
              ❤️ <span className="tabular-nums">{likeCount}</span>
            </button>
            <button
              onClick={toggleBookmark}
              disabled={bookmarking}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100"
            >
              {bookmarked ? "⭐" : "☆"}
            </button>
            <button
              onClick={cycleShelf}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100"
            >
              📚 <span>{shelfStatusLabel}</span>
            </button>
          </div>

          {/* Reply box */}
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
                  disabled={replySending}
                  className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1 text-sm text-white disabled:opacity-60"
                >
                  {replySending ? "Sending…" : "Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------- fetch helper ---------- */
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json().catch(() => ({}));
}

function timeAgo(dateString: string) {
  const now = new Date();
  const then = new Date(dateString);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000); // seconds

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;

  // fallback to YYYY-MM-DD
  return then.toISOString().slice(0, 10);
}

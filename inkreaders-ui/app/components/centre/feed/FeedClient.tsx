// app/components/feed/FeedClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../util/ToastProvider";
import Composer from "./Composer";
import PostCard from "./PostCard";
import { extractImages, extractExternal } from "./helpers";

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

export default function FeedClient() {
  const { push } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feedSource, setFeedSource] = useState<"app" | "user">("app");
  const [bsConnected, setBsConnected] = useState<boolean>(false);
  const [effectiveSource, setEffectiveSource] = useState<"app" | "user">("app");

  /* ---------- map timeline -> Post[] ---------- */
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

  /* ---------- timeline loading ---------- */
  async function loadTimeline() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE}/api/bsky/timeline?limit=30&source=${feedSource}`,
        { cache: "no-store", credentials: "include" }
      );

      // If user tab requested but not authorized, show empty feed with banner
      if (res.status === 401 && feedSource === "user") {
        setPosts([]);
        setError(null);
        setEffectiveSource("user");
        setLoading(false);
        return;
      }

      const servedBy = (res.headers.get("X-IR-Source") as "app" | "user" | null) ?? null;
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

  /* ---------- initial prefs and bluesky check ---------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/prefs`, { credentials: "include" });
        if (r.ok) {
          const j = await r.json();
          if (j.defaultFeed === "user" || j.defaultFeed === "app") {
            setFeedSource(j.defaultFeed);
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (!alive) return;
        setBsConnected(res.ok);
      } catch {
        if (alive) setBsConnected(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedSource]);

  /* ---------- posting handler ---------- */
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
            book: { title: p.book.title, authors: p.book.author ? [p.book.author] : [] },
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
            article: { title: p.article.title, url: p.article.source || "", source: "" },
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
      push({ variant: "error", title: "Post failed", message: e?.message ?? "Try again" });
    }
  }

  /* ---------- UI render ---------- */
  return (
    <div className="space-y-4">
      {/* Sticky header: Composer + Tabs + optional warning */}
      <div className="sticky top-0 z-10 space-y-4 bg-gray-50 pb-2">
        <Composer onPost={handlePost} />

        {/* Feed tabs */}
        <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeedSource("app")}
              className={
                "rounded-xl px-3 py-1 text-sm font-medium transition " +
                (feedSource === "app"
                  ? "bg-[color:var(--color-brand)] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
            >
              InkFlow
            </button>

            <button
              type="button"
              onClick={() => setFeedSource("user")}
              className={
                "rounded-xl px-3 py-1 text-sm font-medium transition " +
                (feedSource === "user"
                  ? "bg-[color:var(--color-brand)] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
              title={bsConnected ? "Your following" : "Connect Bluesky to enable"}
            >
              Your Shelf
            </button>

            <div className="ml-auto text-xs text-gray-500 px-2">
              Showing:{" "}
              <span className="font-medium">
                {effectiveSource === "user" ? "Your Shelf" : "InkFlow"}
              </span>
            </div>
          </div>
        </div>

        {/* Bluesky not connected warning (keeps inside sticky area) */}
        {!bsConnected && feedSource === "user" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Connect Bluesky to see your following feed.{" "}
            <a className="underline font-medium" href="/settings">
              Connect now
            </a>
          </div>
        )}
      </div>

      {/* Timeline content: loading / error / empty / posts */}
      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm text-gray-500">
          Loading…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadTimeline} className="ml-3 underline text-sm font-medium">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-500 text-center shadow-sm">
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

/* ---------- shared fetch helper (kept local) ---------- */
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

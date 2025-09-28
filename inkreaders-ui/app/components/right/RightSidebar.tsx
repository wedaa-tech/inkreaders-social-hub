// app/components/RightSidebar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { postJSON } from "../../../lib/api";
import { useToast } from "../util/ToastProvider";

type TrendingItem = {
  bookId: number; 
  title: string;
  authors: string[];
  link?: string | null;
  count: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const REFRESH_MS = 20_000;   // auto-refresh every 20s
const TOP_N = 5;
const PANEL_MAX_H = "20rem";

export default function RightSidebar() {
  const [items, setItems] = useState<TrendingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { push } = useToast();

  // avoid overlapping requests and race conditions
  const inflight = useRef<AbortController | null>(null);

  async function load() {
    // cancel previous request if still running
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    try {
      setLoading(true);
      setError(null);

      // add a cache-busting param just in case proxies are aggressive
      const url = `${API_BASE}/api/discovery/trending-books?limit=${TOP_N}&t=${Date.now()}`;

      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`trending-books ${res.status}`);

      const json = await res.json();
      setItems(json?.items ?? []);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (e?.name === "AbortError") return; // ignore aborted request
      setError(e?.message || "Failed to load trending");
      setItems([]);
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        setLoading(false);
      }
    }
  }

  async function follow(handle: string) {
    try {
      await postJSON(`${API_BASE}/api/bsky/follow`, { didOrHandle: handle });
      push({ variant: "success", title: "Followed", message: `You followed ${handle}` });
    } catch (e: any) {
      push({ variant: "error", title: "Follow failed", message: e?.message || "Please try again" });
    }
  }

  useEffect(() => {
    // initial load
    load();

    // auto-refresh timer
    let t: number | undefined;
    function start() {
      t = window.setInterval(load, REFRESH_MS);
    }
    function stop() {
      if (t) window.clearInterval(t);
      t = undefined;
    }

    // pause when tab is hidden to save resources
    function onVisibility() {
      if (document.hidden) stop();
      else {
        load(); // refresh immediately on return
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      inflight.current?.abort();
    };
  }, []);

  return (
    <div className="sticky top-4 space-y-4">
      {/* Search at top */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <input
          placeholder="Search books, articles, people"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
      </div>

      {/* Trending Books */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Trending Books <span className="text-xs text-gray-500">(Top {TOP_N}, 24h)</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-gray-600 underline decoration-dotted underline-offset-4 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {lastUpdated && (
          <div className="mb-2 text-xs text-gray-400">
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {error ? (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        ) : (items?.length ?? 0) === 0 ? (
          <div className="mt-2 text-sm text-gray-500">No trending books yet. Be the first to post! 📚</div>
        ) : (
          <ul className="mt-2 space-y-3 pr-1" style={{ maxHeight: PANEL_MAX_H, overflowY: "auto" }}>
            {items!.map((b) => (
              <li key={b.bookId} className="group flex items-start gap-3">
                <div className="mt-1 h-8 w-8 shrink-0 rounded-md bg-gray-100" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium leading-5">{b.title}</div>
                  <div className="truncate text-sm text-gray-500">
                    {b.authors?.length ? b.authors.join(", ") : "Unknown author"}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">Posts (24h): {b.count}</div>
                </div>
                {b.link ? (
                  <a
                    href={b.link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Who to follow */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold">Who to follow</h3>
        <ul className="space-y-3">
          {["@papertrail", "@litdaily", "@nonfictionhub"].map((h) => (
            <li key={h} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{h.replace("@", "")}</div>
                  <div className="truncate text-sm text-gray-500">{h}</div>
                </div>
              </div>
              <button
                onClick={() => follow(h)}
                className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200"
                >
                  Follow
                </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-500">
        <p>Powered by AT Protocol (coming soon)</p>
        <p className="mt-1">&copy; {new Date().getFullYear()} InkReaders</p>
      </div>
    </div>
  );
}

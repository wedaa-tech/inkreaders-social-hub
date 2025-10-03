// app/exercises/mine/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedPage from "@/app/components/auth/ProtectedPage";
import { apiFetch, apiFetchJson } from "@/lib/api";

type ExerciseSet = {
  id: string;
  title: string;
  format: string;
  created_at: string;
  visibility: string;
  at_uri?: string | null;
  feed_uri?: string | null;
  meta?: {
    difficulty?: string;
    language?: string;
  };
};

export default function ExercisesMinePage() {
  const [items, setItems] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function fetchMine() {
    setLoading(true);
    try {
      const data = await apiFetchJson<{ items: ExerciseSet[] }>("/api/exercises/mine", {
        cache: "no-store",
      });
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMine();
  }, []);

  function blueskyUrl(it: ExerciseSet) {
    const uri = it.feed_uri || it.at_uri;
    if (!uri) return "#";
    if (/^https?:\/\//i.test(uri)) return uri;
    if (uri.startsWith("at://")) {
      const parts = uri.split("/");
      if (parts.length >= 5) {
        const did = parts[2];
        const rkey = parts[4];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
      }
    }
    return "#";
  }

  async function handlePublish(id: string) {
    setBusy(id + "-pub");
    try {
      const res = await apiFetch(`/api/exercises/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_feed: true, allow_remix: true }),
      });
      if (!res.ok) return alert("Publish failed");

      const pub = (await res.json()) as { at_uri?: string; feed_uri?: string };
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, at_uri: pub.at_uri ?? it.at_uri, feed_uri: pub.feed_uri ?? it.feed_uri }
            : it
        )
      );
      await fetchMine();
    } finally {
      setBusy(null);
    }
  }

  async function handleRemix(id: string) {
    setBusy(id + "-remix");
    try {
      const res = await apiFetch(`/api/exercises/${id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transform: {
            increase_difficulty: true,
            reduce_count_to: 0,
            switch_format_to: "",
          },
          note: "User requested remix from Mine page",
        }),
      });
      if (!res.ok) return alert("Remix failed");

      const data = await res.json();
      const newId = data.derived_set_id;
      if (newId) router.push(`/exercises/${newId}/preview`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ProtectedPage>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header + New Exercise */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">My Exercises</h1>
          <Link
            href="/exercises/generate"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200"
          >
            + New Exercise
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <p className="text-lg text-gray-600 animate-pulse">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 text-lg py-12">
            No exercises yet. Try generating one!
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const hasBsky = Boolean(it.feed_uri) || Boolean(it.at_uri);
              return (
                <li
                  key={it.id}
                  className="relative group bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <h2 className="text-xl font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {it.title}
                  </h2>

                  <p className="text-sm text-gray-500 mt-2">
                    {it.format?.toUpperCase()} •{" "}
                    <span className="capitalize">{it.visibility}</span>
                  </p>

                  {(it.meta?.difficulty || it.meta?.language) && (
                    <p className="text-sm text-gray-400 mt-1">
                      {it.meta?.difficulty ?? "mixed"} • {it.meta?.language ?? "en"}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(it.created_at).toLocaleString()}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <Link
                      href={`/exercises/${it.id}/preview`}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 font-medium rounded-md hover:bg-blue-200 transition-colors"
                    >
                      Preview
                    </Link>

                    {!hasBsky ? (
                      <button
                        onClick={() => handlePublish(it.id)}
                        disabled={busy === it.id + "-pub"}
                        className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 font-medium rounded-md hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy === it.id + "-pub" ? "Publishing..." : "Publish"}
                      </button>
                    ) : (
                      <a
                        href={blueskyUrl(it)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 font-medium rounded-md hover:bg-green-200 transition-colors"
                      >
                        View on Bluesky ↗
                      </a>
                    )}

                    <button
                      onClick={() => handleRemix(it.id)}
                      disabled={busy === it.id + "-remix"}
                      className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy === it.id + "-remix" ? "Remixing..." : "Remix"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ProtectedPage>
  );
}

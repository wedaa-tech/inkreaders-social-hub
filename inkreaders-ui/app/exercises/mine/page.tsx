"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

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
      const res = await fetch(`${API_BASE}/api/exercises/mine`, {
        credentials: "include",
        cache: "no-store", // ← prevent stale list after publish
      });
      if (res.ok) {
        const data = await res.json();
        setItems((data.items || []) as ExerciseSet[]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMine();
  }, []);

  function blueskyUrl(it: ExerciseSet) {
    const uri = it.feed_uri || it.at_uri;
    console.log(
      "[blueskyUrl] item id:",
      it.id,
      "feed_uri:",
      it.feed_uri,
      "at_uri:",
      it.at_uri
    );

    if (!uri) {
      console.log("[blueskyUrl] no uri found, returning #");
      return "#";
    }

    // If server gave us a normal web URL, just use it.
    if (/^https?:\/\//i.test(uri)) {
      console.log("[blueskyUrl] returning direct URL:", uri);
      return uri;
    }

    // Handle at://did/.../app.bsky.feed.post/<rkey>
    if (uri.startsWith("at://")) {
      const parts = uri.split("/");
      console.log("[blueskyUrl] parsed at:// parts:", parts);

      if (parts.length >= 5) {
        const did = parts[2]; // did:plc:xxxx
        const rkey = parts[4];
        const url = `https://bsky.app/profile/${did}/post/${rkey}`;
        console.log("[blueskyUrl] returning constructed Bluesky URL:", url);
        return url;
      }
    }

    console.log("[blueskyUrl] unhandled format, returning #");
    return "#";
  }

  async function handlePublish(id: string) {
    setBusy(id + "-pub");
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to_feed: true, allow_remix: true }),
      });

      if (!res.ok) {
        alert("Publish failed");
        return;
      }

      const pub = (await res.json()) as { at_uri?: string; feed_uri?: string };

      // ✅ Optimistic local update so the button flips immediately
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                at_uri: pub.at_uri ?? it.at_uri,
                feed_uri: pub.feed_uri ?? it.feed_uri,
              }
            : it
        )
      );

      // ✅ Force-refresh from server (no-store) to stay in sync
      await fetchMine();
    } finally {
      setBusy(null);
    }
  }

  async function handleRemix(id: string) {
    setBusy(id + "-remix");
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transform: {
            increase_difficulty: true,
            reduce_count_to: 0,
            switch_format_to: "",
          },
          note: "User requested remix from Mine page",
        }),
      });

      if (!res.ok) {
        alert("Remix failed");
        return;
      }

      const data = await res.json();
      const newId = data.derived_set_id;
      if (newId) {
        router.push(`/exercises/${newId}/preview`);
      } else {
        alert("Remix failed: no ID returned");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
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
            // console.log("[MinePage] Rendering item:", {
            //   id: it.id,
            //   title: it.title,
            //   feed_uri: it.feed_uri,
            //   at_uri: it.at_uri,
            //   hasBsky,
            // });
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
                    {it.meta?.difficulty ?? "mixed"} •{" "}
                    {it.meta?.language ?? "en"}
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
  );
}

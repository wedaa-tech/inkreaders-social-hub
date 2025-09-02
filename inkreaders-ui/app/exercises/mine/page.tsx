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
  at_uri?: string;
  feed_uri?: string;
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
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMine();
  }, []);

  async function handlePublish(id: string) {
    setBusy(id + "-pub");
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to_feed: true, allow_remix: true }),
      });
      if (res.ok) {
        alert("Published!");
        fetchMine();
      } else {
        alert("Publish failed");
      }
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
        body: JSON.stringify({ harder: false, reduce_to: 0, transform: "" }),
      });
      if (res.ok) {
        const data = await res.json();
        alert("Remixed!");
        router.push(`/exercises/${data.id}/preview`);
      } else {
        alert("Remix failed");
      }
    } finally {
      setBusy(null);
    }
  }

  function blueskyUrl(it: ExerciseSet) {
    if (it.feed_uri) {
      const parts = it.feed_uri.split("/");
      if (parts.length >= 5) {
        const did = parts[2];
        const rkey = parts[4];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
      }
      return "#";
    }

    if (it.at_uri) {
      const parts = it.at_uri.split("/");
      if (parts.length >= 5) {
        const did = parts[2];
        const rkey = parts[4];
        return `https://bsky.app/profile/${did}/post/${rkey}`;
      }
    }

    return "#";
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
          {items.map((it) => (
            <li
              key={it.id}
              className="relative group bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <h2 className="text-xl font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {it.title}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {it.format.toUpperCase()} •{" "}
                <span className="capitalize">{it.visibility}</span>
              </p>
              {it.meta?.difficulty && (
                <p className="text-sm text-gray-400 mt-1">
                  {it.meta.difficulty} • {it.meta.language}
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

                {!it.at_uri && !it.feed_uri ? (
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
          ))}
        </ul>
      )}
    </div>
  );
}
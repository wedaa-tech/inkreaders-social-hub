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

  function bskyUrl(at_uri: string) {
    // at://did:plc:xyz/collection/rkey
    const parts = at_uri.split("/");
    if (parts.length < 4) return "#";
    const did = parts[2];
    const rkey = parts[4];
    return `https://bsky.app/profile/${did}/post/${rkey}`;
  }

  return (
    <div className="space-y-6">
      {/* Header + New Exercise */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Exercises</h1>
        <Link
          href="/exercises/generate"
          className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-white font-medium hover:opacity-90"
        >
          + New Exercise
        </Link>
      </div>

      {/* List */}
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No exercises yet. Try generating one!</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-xl border bg-white p-4 shadow hover:shadow-md transition"
            >
              <h2 className="font-semibold text-lg truncate">{it.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {it.format.toUpperCase()} • {it.visibility}
              </p>
              {it.meta?.difficulty && (
                <p className="text-xs text-gray-400 mt-1">
                  {it.meta.difficulty} • {it.meta.language}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(it.created_at).toLocaleString()}
              </p>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  href={`/exercises/${it.id}/preview`}
                  className="text-[color:var(--color-brand)] font-medium hover:underline"
                >
                  Preview
                </Link>

                {!it.at_uri ? (
                  <button
                    onClick={() => handlePublish(it.id)}
                    disabled={busy === it.id + "-pub"}
                    className="text-green-600 hover:underline disabled:opacity-50"
                  >
                    {busy === it.id + "-pub" ? "Publishing…" : "Publish"}
                  </button>
                ) : (
                  <a
                    href={bskyUrl(it.at_uri)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 font-medium hover:underline"
                  >
                    View on Bluesky ↗
                  </a>
                )}

                <button
                  onClick={() => handleRemix(it.id)}
                  disabled={busy === it.id + "-remix"}
                  className="text-blue-600 hover:underline disabled:opacity-50"
                >
                  {busy === it.id + "-remix" ? "Remixing…" : "Remix"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

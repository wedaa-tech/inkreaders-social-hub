"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function PreviewExercise() {
  const router = useRouter();
  const [exercise, setExercise] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [feedUri, setFeedUri] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("previewExercise");
    if (raw) {
      setExercise(JSON.parse(raw));
    }
  }, []);

  async function handleSave() {
    if (!exercise) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_set: exercise,
          visibility: "private",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setExerciseId(data.id);
      alert("Saved successfully!");
    } catch (err) {
      alert("Save failed: " + err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!exerciseId) return alert("Save first before publishing!");
    setPublishing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/exercises/${exerciseId}/publish`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_feed: true, allow_remix: true }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFeedUri(data.feed_uri || null);
      alert("Published!");
    } catch (err) {
      alert("Publish failed: " + err);
    } finally {
      setPublishing(false);
    }
  }

  function blueskyUrl(uri: string) {
    const parts = uri.split("/");
    if (parts.length >= 5) {
      const did = parts[2];
      const rkey = parts[4];
      return `https://bsky.app/profile/${did}/post/${rkey}`;
    }
    return "#";
  }

  if (!exercise) {
    return <p className="p-6 text-gray-500">No exercise to preview.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Preview Exercise</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="bg-white rounded-xl p-6 shadow space-y-4">
        <h2 className="text-xl font-semibold">{exercise.title}</h2>
        <p className="text-gray-600">
          Format: {exercise.format} • {exercise.questions?.length || 0} questions
        </p>

        <ul className="space-y-3">
          {exercise.questions?.map((q: any, idx: number) => (
            <li key={idx} className="rounded-lg border bg-gray-50 p-3">
              <p className="font-medium">
                Q{idx + 1}. {q.q}
              </p>
              {q.options && (
                <ul className="ml-4 list-disc text-sm text-gray-600">
                  {q.options.map((o: string, i: number) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-green-700 mt-1">
                Answer: {String(q.answer)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {!feedUri ? (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          ) : (
            <a
              href={blueskyUrl(feedUri)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700"
            >
              View on Bluesky ↗
            </a>
          )}

          <Link
            href="/exercises"
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

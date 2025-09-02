"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function ExercisePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [exercise, setExercise] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [remixing, setRemixing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/exercises/${id}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (alive) setExercise(data.exercise_set || data); // ✅ safer
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function handlePublish() {
    if (!exercise) return;
    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to_feed: true, allow_remix: true }),
      });
      if (res.ok) {
        const data = await res.json();
        alert("Published!");
        setExercise({ ...exercise, at_uri: data.at_uri, feed_uri: data.feed_uri });
        router.refresh();
      } else {
        alert("Publish failed");
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleRemix() {
    if (!exercise) return;
    setRemixing(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ harder: true, reduce_to: 3, transform: "mcq" }),
      });
      if (res.ok) {
        const data = await res.json();
        alert("Remixed!");
        router.push(`/exercises/${data.derived_set_id}/preview`);
      } else {
        alert("Remix failed");
      }
    } finally {
      setRemixing(false);
    }
  }

  function bskyUrl(at_uri: string) {
    const parts = at_uri.split("/");
    if (parts.length < 5) return "#";
    const did = parts[2];
    const rkey = parts[4];
    return `https://bsky.app/profile/${did}/post/${rkey}`;
  }

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }
  if (!exercise) {
    return <p className="p-6 text-red-600">Exercise not found.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Preview Exercise</h1>
        <Link href="/exercises/mine" className="text-blue-600 hover:underline">
          ← Back
        </Link>
      </div>

      <div className="bg-white rounded-xl p-6 shadow space-y-4">
        <h2 className="text-xl font-semibold">{exercise.title}</h2>
        <p className="text-gray-500">
          {(exercise.format || "N/A").toUpperCase()} •{" "}
          {exercise.meta?.difficulty || "n/a"} •{" "}
          {exercise.meta?.language || "n/a"}
        </p>

        <ul className="space-y-3">
          {exercise.questions && exercise.questions.length > 0 ? (
            exercise.questions.map((q: any, idx: number) => (
              <li key={idx} className="rounded-lg border bg-gray-50 p-3">
                <p className="font-medium">Q{idx + 1}. {q.q}</p>
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
            ))
          ) : (
            <p className="italic text-gray-500">No questions yet.</p>
          )}
        </ul>

        <div className="flex gap-3">
          {!exercise.at_uri && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          )}
          {exercise.feed_uri && (
            <a
              href={bskyUrl(exercise.feed_uri)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:opacity-90"
            >
              View on Bluesky ↗
            </a>
          )}
          <button
            onClick={handleRemix}
            disabled={remixing}
            className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {remixing ? "Remixing..." : "Remix"}
          </button>
        </div>
      </div>
    </div>
  );
}

// app/exercises/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type ExerciseSet = {
  id: string;
  title: string;
  format: string;
  visibility: string;
  created_at: string;
  at_uri?: string;
};

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchMine() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/mine`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExercises(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function publishExercise(id: string) {
    if (!confirm("Publish this exercise to ATProto?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_feed: true, allow_remix: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Published successfully!");
      fetchMine();
    } catch (err) {
      alert("Error: " + err);
    }
  }

  useEffect(() => {
    fetchMine();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Exercises</h1>
        <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : exercises.length === 0 ? (
        <p className="text-gray-500">No exercises yet. Try <Link href="/exercises/generate" className="text-blue-600 hover:underline">generating one</Link>!</p>
      ) : (
        <ul className="space-y-4">
          {exercises.map((ex) => (
            <li key={ex.id} className="rounded-xl border p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">{ex.title}</h2>
                  <p className="text-sm text-gray-600">
                    {ex.format} • {new Date(ex.created_at).toLocaleString()}
                  </p>
                  {ex.at_uri && (
                    <p className="text-xs text-green-600">Published: {ex.at_uri}</p>
                  )}
                </div>
                {!ex.at_uri && (
                  <button
                    onClick={() => publishExercise(ex.id)}
                    className="rounded-lg bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                  >
                    Publish
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeExercise, toApiExercise, Exercise } from "@/lib/normalizeExercise";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function ExercisesGeneratePage() {
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en"); // remember form language
  const router = useRouter();

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const lang = (form.get("language")?.toString() as "en" | "hi") || "en";
    setLanguage(lang);

    const body = {
      title: form.get("title")?.toString() || "",
      topic: form.get("topic")?.toString() || "",
      formats: [form.get("format")?.toString() || "mcq"],
      count: Number(form.get("count") || 5),
      difficulty: form.get("difficulty")?.toString() || "mixed",
      language: lang,
      source: { type: "topic" },
    };

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to generate exercise");
      const data = await res.json();
      setExercise(normalizeExercise(data.exercise_set));
    } catch (err) {
      console.error(err);
      alert("Error generating exercise");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndPreview() {
    if (!exercise) return;

    try {
      const res = await fetch(`${API_BASE}/api/exercises/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exercise_set: exercise,
          visibility: "private",
        }),
      });

      if (!res.ok) throw new Error("Failed to save exercise");
      const data = await res.json();
      const newId = data.id;

      router.push(`/exercises/${newId}/preview`);
    } catch (err) {
      console.error(err);
      alert("Could not save exercise");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Generate Exercise</h1>
        <a href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </a>
      </div>

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="space-y-4 bg-white p-6 rounded-xl shadow"
      >
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            type="text"
            name="title"
            placeholder="Optional title"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Topic</label>
          <input
            type="text"
            name="topic"
            placeholder="e.g. Space Exploration"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Format</label>
          <select
            name="format"
            className="w-full rounded-lg border px-3 py-2"
            defaultValue="mcq"
          >
            <option value="mcq">Multiple Choice</option>
            <option value="true_false">True/False</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="match">Matching</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Only one format can be selected per exercise set.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Number of Questions</label>
          <input
            type="number"
            name="count"
            defaultValue={5}
            min={1}
            max={20}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Difficulty</label>
          <select
            name="difficulty"
            className="w-full rounded-lg border px-3 py-2"
            defaultValue="mixed"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Language</label>
          <select
            name="language"
            className="w-full rounded-lg border px-3 py-2"
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {/* Preview */}
      {exercise && (
        <div className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold">Preview Generated Set</h2>
          <p className="text-gray-500">
            {exercise.title} • {exercise.format.toUpperCase()} •{" "}
            {exercise.difficulty}
          </p>

          <ul className="space-y-3">
            {exercise.questions?.map((q, idx) => (
              <li key={q.id} className="rounded-lg border bg-gray-50 p-3">
                <p className="font-medium">
                  Q{idx + 1}. {q.prompt}
                </p>
                {q.options && q.options.length > 0 && (
                  <ul className="ml-4 list-disc text-sm text-gray-600">
                    {q.options.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-green-700 mt-1">
                  Answer: {Array.isArray(q.correctAnswer)
                    ? q.correctAnswer.join(", ")
                    : typeof q.correctAnswer === "object"
                    ? JSON.stringify(q.correctAnswer)
                    : String(q.correctAnswer)}
                </p>
              </li>
            ))}
          </ul>

          <button
            onClick={handleSaveAndPreview}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:opacity-90"
          >
            Save & Continue →
          </button>
        </div>
      )}
    </div>
  );
}

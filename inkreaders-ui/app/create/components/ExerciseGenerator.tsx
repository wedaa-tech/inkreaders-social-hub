// app/create/components/ExerciseGenerator.tsx
"use client";

import React, { useState } from "react";
import { FaSpinner } from "@/app/create/components/icons";
import PreviewCard from "@/app/create/components/PreviewCard";
import { normalizeExercise, Exercise as NormalizedExercise } from "@/lib/normalizeExercise";
import { useToast } from "@/app/components/util/ToastProvider";
import QuestionPreview from "./QuestionPreview";
import { apiFetchJson } from "@/lib/api"; // ✅ central fetch helper (no API_BASE anymore)

export default function ExerciseGenerator() {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<NormalizedExercise | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      title: form.get("title")?.toString() || "",
      topic: form.get("topic")?.toString() || "",
      formats: [form.get("format")?.toString() || "mcq"],
      count: Number(form.get("count") || 5),
      difficulty: form.get("difficulty")?.toString() || "mixed",
      language: (form.get("language")?.toString() as "en" | "hi") || "en",
      source: { type: "topic" },
    };

    setLoading(true);
    try {
      console.log("📡 Generating exercise:", body);
      const data = await apiFetchJson<{ exercise_set: any }>("/api/exercises/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      console.log("📦 Raw API response (generate):", data);

      const normalized = normalizeExercise(data.exercise_set);
      console.log("✅ Normalized generated exercise:", normalized);

      setExercise(normalized);
      setLanguage(body.language);
      push({ variant: "success", message: "Generated exercise preview" });
    } catch (err: any) {
      console.error("🔥 Generate failed:", err);
      push({
        variant: "error",
        title: "Generate failed",
        message: err.message || "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndPreview() {
    if (!exercise) return;
    try {
      console.log("💾 Saving exercise:", exercise);
      const data = await apiFetchJson<{ id: string }>("/api/exercises/save", {
        method: "POST",
        body: JSON.stringify({ exercise_set: exercise, visibility: "private" }),
      });
      console.log("📦 Raw API response (save):", data);

      if (data.id) {
        window.location.href = `/exercises/${data.id}/preview`;
      }
    } catch (err: any) {
      console.error("🔥 Save failed:", err);
      push({
        variant: "error",
        title: "Save failed",
        message: err.message || "Could not save exercise",
      });
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Generate an Exercise</h3>
        <form
          onSubmit={handleGenerate}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            name="title"
            placeholder="Title (optional)"
            className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent col-span-2"
          />
          <input
            name="topic"
            placeholder="Topic (e.g., Solar System)"
            required
            className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent col-span-2"
          />

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Format</label>
            <select
              name="format"
              defaultValue="mcq"
              className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
            >
              <option value="mcq">Multiple Choice</option>
              <option value="true_false">True/False</option>
              <option value="fill_blank">Fill in the Blank</option>
              <option value="match">Matching</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Count</label>
            <input
              name="count"
              type="number"
              defaultValue={5}
              min={1}
              max={20}
              className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Difficulty</label>
            <select
              name="difficulty"
              defaultValue="mixed"
              className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Language</label>
            <select
              name="language"
              defaultValue="en"
              className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          <div className="col-span-full flex gap-3 mt-4 justify-end">
            <button
              type="button"
              onClick={() => {
                setExercise(null);
                push({ variant: "success", message: "Cleared" });
              }}
              className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center rounded-xl bg-[color:var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <FaSpinner className="animate-spin mr-2" />}
              {loading ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndPreview}
              disabled={!exercise}
              className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Continue
            </button>
          </div>
        </form>

        {/* Preview */}
        {exercise ? (
          <div className="mt-6 rounded-2xl bg-gray-100 p-5 border border-gray-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
              <div>
                <div className="font-semibold text-gray-800">
                  {exercise.title || "(untitled)"}
                </div>
                <div className="text-sm text-gray-600">
                  {exercise.format?.toUpperCase()} • {exercise.difficulty}
                </div>
              </div>
              <div className="text-sm text-gray-500">Language: {language}</div>
            </div>

            <ul className="space-y-4 mt-3">
              {exercise.questions?.map((q, idx) => (
                <QuestionPreview key={q.id} q={q} index={idx} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-gray-100 p-6 text-center text-gray-500">
            <span className="text-4xl text-gray-400 block mb-2">⚠️</span>
            <div className="text-sm">
              No preview yet — generate to see the exercise.
            </div>
          </div>
        )}
      </div>

      {/* Live preview card */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner">
        <h4 className="text-xl font-semibold mb-4 text-gray-800">
          Preview as Post
        </h4>
        <PreviewCard
          title={exercise ? exercise.title || "Exercise Preview" : "Exercise Preview"}
          subtitle={
            exercise
              ? `${exercise.format?.toUpperCase()} • ${exercise.difficulty}`
              : "Provide topic and generate"
          }
          body={
            exercise
              ? exercise.questions
                  .slice(0, 6)
                  .map((q, i) => `${i + 1}. ${q.prompt}`)
                  .join("\n")
              : "Generate to see a preview…"
          }
          tags={["Exercise", "Learning"]}
        />
      </div>
    </section>
  );
}

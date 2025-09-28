"use client";

//import { Exercise, UserAnswer, Question } from "@/app/exercises/[id]/preview/page";
import { useState } from "react";

import {
  normalizeExercise,
  Exercise,
  UserAnswer,
  Question
} from "@/lib/normalizeExercise";

type Props = {
  exercise: Exercise;
  answers: Record<string, UserAnswer>;
  score: number;
  onRetry: () => void;
};

function prettyAnswer(val: unknown, type: Question["type"]): string {
  if (val == null) return "—";
  if (type === "true_false") {
    const s = String(val).toLowerCase().trim();
    if (s === "true") return "True";
    if (s === "false") return "False";
    return s || "—";
  }
  if (Array.isArray(val)) {
    return val.length ? val.join(", ") : "—";
  }
  if (typeof val === "object") {
    try {
      const obj = val as Record<string, string>;
      const entries = Object.entries(obj);
      return entries.length ? entries.map(([k, v]) => `${k} → ${v || "—"}`).join(", ") : "—";
    } catch {
      return "—";
    }
  }
  const s = String(val);
  return s.length ? s : "—";
}

export default function ExerciseResults({ exercise, answers, score, onRetry }: Props) {
  const total = exercise.questions.length;

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-semibold">Results</h2>
      <p className="text-gray-600 mt-1">
        Score: {score} / {total}
      </p>

      <ol className="mt-4 space-y-3">
        {exercise.questions.map((q, idx) => {
          const ua = answers[q.id];
          const correct = ua?.isCorrect;

          return (
            <li key={q.id} className="border rounded-lg p-3">
              <p className="font-medium">Q{idx + 1}. {q.prompt || "—"}</p>

              <p className="text-sm mt-1">
                Your answer:{" "}
                <span className={correct ? "text-green-700" : "text-red-700"}>
                  {prettyAnswer(ua?.value, q.type)}
                </span>
                {!correct && (
                  <>
                    {" "}
                    <span className="text-gray-500">
                      (Correct: {prettyAnswer(q.correctAnswer, q.type)})
                    </span>
                  </>
                )}
              </p>

              {q.explanation && (
                <p className="text-xs text-gray-500 mt-1">Why: {q.explanation}</p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex gap-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

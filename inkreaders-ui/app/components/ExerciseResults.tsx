"use client";

import { Exercise, UserAnswer, Question } from "@/app/exercises/[id]/preview/page";
import { useState } from "react";

type Props = {
  exercise: Exercise;
  answers: Record<string, UserAnswer>;
  score: number;
  onRetry: () => void;
};

export default function ExerciseResults({ exercise, answers, score, onRetry }: Props) {
  const [loadingRemix, setLoadingRemix] = useState(false);

  const handleRemix = async () => {
    try {
      setLoadingRemix(true);
      const res = await fetch(`/api/exercises/${exercise.id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ include session cookies
        body: JSON.stringify({
          transform: {
            increase_difficulty: true,
            reduce_count_to: 0,
            switch_format_to: "",
          },
          note: "User requested harder remix from results page",
        }),
      });

      if (!res.ok) throw new Error("Failed to remix exercise");

      const data = await res.json();
      const newId = data.derived_set_id; // ✅ backend field

      if (!newId) throw new Error("No remix ID returned");

      // ✅ Redirect to new exercise preview
      window.location.href = `/exercises/${newId}/preview`;
    } catch (err) {
      console.error(err);
      alert("Could not remix exercise. Please try again.");
    } finally {
      setLoadingRemix(false);
    }
  };

  const renderAnswer = (q: Question, ans?: UserAnswer) => {
    if (!ans) return <p className="text-gray-500">No answer provided</p>;

    if (q.type === "match") {
      return (
        <div className="mt-2">
          <p className={ans.isCorrect ? "text-green-600" : "text-red-600"}>
            Your order: {Array.isArray(ans.value) ? ans.value.join(" → ") : String(ans.value)}
          </p>
          {Array.isArray(q.correctAnswer) && !ans.isCorrect && (
            <p className="text-green-600">
              Correct order: {q.correctAnswer.join(" → ")}
            </p>
          )}
        </div>
      );
    }

    return (
      <p className={ans.isCorrect ? "text-green-600" : "text-red-600"}>
        Your answer: {String(ans.value)}
        {!ans.isCorrect && (
          <span className="ml-2 text-green-600">
            (Correct: {String(q.correctAnswer)})
          </span>
        )}
      </p>
    );
  };

  return (
    <div className="my-6">
      <h2 className="text-xl font-bold mb-4">
        Results: {score} / {exercise.questions.length}
      </h2>

      {exercise.questions.map((q) => {
        const ans = answers[q.id];
        return (
          <div key={q.id} className="mb-4 border p-3 rounded">
            <p className="font-medium">{q.prompt}</p>
            {renderAnswer(q, ans)}
            {q.explanation && (
              <p className="text-sm text-gray-600 mt-1">{q.explanation}</p>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
        <button
          onClick={handleRemix}
          disabled={loadingRemix}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          {loadingRemix ? "Remixing..." : "Remix Harder"}
        </button>
      </div>
    </div>
  );
}

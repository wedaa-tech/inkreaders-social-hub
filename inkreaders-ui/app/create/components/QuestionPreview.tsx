// app/create/components/QuestionPreview.tsx
"use client";

import React, { useState } from "react";
import ExplanationPanel from "./ExplanationPanel";

export type QShape = {
  id: string;
  type?: string;
  prompt: string;
  options?: string[];
  correctAnswer?: string | string[] | Record<string, string>;
  explanation?: string;
};

function prettyAnswer(ans: any) {
  if (Array.isArray(ans)) return ans.join(", ");
  if (typeof ans === "object" && ans !== null) return JSON.stringify(ans);
  return String(ans ?? "");
}

export default function QuestionPreview({ q, index }: { q: QShape; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const answerText = prettyAnswer(q.correctAnswer);

  const explanationPrompt = `${q.prompt}\n\nOptions:\n${(q.options || []).join("\n")}\n\nAnswer: ${answerText}`;

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-gray-800">
            Q{index + 1}. {q.prompt}
          </p>

          {q.options && q.options.length > 0 && (
            <ul className="ml-4 mt-2 list-disc text-sm text-gray-700">
              {q.options.map((o, i) => (
                <li key={i} className="py-0.5">{o}</li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <button
              onClick={() => setShowAnswer((s) => !s)}
              className="rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
              aria-expanded={showAnswer}
            >
              {showAnswer ? "Hide answer" : "Show answer"}
            </button>

            {showAnswer && (
              <div className="mt-2 rounded-md bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800">
                <strong>Answer:</strong> {answerText || "—"}
              </div>
            )}
          </div>

          {/* Explanation panel */}
          <ExplanationPanel questionId={q.id} prompt={explanationPrompt} answer={answerText} />
        </div>

        <div className="flex-shrink-0 text-sm text-gray-500">
          <div className="mb-2">{(q.type || "mcq").toUpperCase()}</div>
        </div>
      </div>
    </li>
  );
}

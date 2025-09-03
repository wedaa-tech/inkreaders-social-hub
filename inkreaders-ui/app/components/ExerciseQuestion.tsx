"use client";

import { useState } from "react";
import { Question, UserAnswer } from "@/lib/normalizeExercise";


type Props = {
  question: Question;
  userAnswer?: UserAnswer;
  onAnswer: (qid: string, value: any) => void;
  onNext: () => void;
};

export default function ExerciseQuestion({
  question,
  userAnswer,
  onAnswer,
  onNext,
}: Props) {
  const [inputValue, setInputValue] = useState("");

  const handleMCQ = (option: string) => {
    onAnswer(question.id, option);
    onNext();
  };

  const handleTrueFalse = (value: boolean) => {
    onAnswer(question.id, String(value));
    onNext();
  };

  const handleFillBlank = () => {
    if (inputValue.trim()) {
      onAnswer(question.id, inputValue.trim());
      setInputValue("");
      onNext();
    }
  };

  const handleMatch = (key: string, value: string) => {
    const current = (userAnswer?.value as Record<string, string>) || {};
    const updated = { ...current, [key]: value };
    onAnswer(question.id, updated);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow space-y-4">
      <h2 className="text-lg font-semibold">{question.prompt}</h2>

      {/* Multiple Choice */}
      {question.type === "mcq" && question.options && (
        <ul className="space-y-2">
          {question.options.map((opt, idx) => (
            <li key={idx}>
              <button
                className={`w-full text-left px-4 py-2 rounded-lg border ${
                  userAnswer?.value === opt
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => handleMCQ(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* True/False */}
      {question.type === "true_false" && (
        <div className="flex gap-4">
          <button
            className={`flex-1 px-4 py-2 rounded-lg border ${
              userAnswer?.value === "true"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 hover:bg-gray-100"
            }`}
            onClick={() => handleTrueFalse(true)}
          >
            True
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-lg border ${
              userAnswer?.value === "false"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 hover:bg-gray-100"
            }`}
            onClick={() => handleTrueFalse(false)}
          >
            False
          </button>
        </div>
      )}

      {/* Fill in the Blank */}
      {question.type === "fill_blank" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            className="flex-1 px-3 py-2 rounded-lg border"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFillBlank();
            }}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            onClick={handleFillBlank}
          >
            Submit
          </button>
        </div>
      )}

      {/* Matching */}
      {question.type === "match" &&
        typeof question.correctAnswer === "object" && (
          <div className="space-y-3">
            {Object.keys(question.correctAnswer).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="font-medium">{key}</span>
                <select
                  className="flex-1 px-3 py-2 rounded-lg border"
                  value={
                    (userAnswer?.value as Record<string, string>)?.[key] || ""
                  }
                  onChange={(e) => handleMatch(key, e.target.value)}
                >
                  <option value="">Select</option>
                  {Array.isArray(question.options) &&
                    question.options.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                </select>
              </div>
            ))}
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={onNext}
            >
              Next →
            </button>
          </div>
        )}
    </div>
  );
}

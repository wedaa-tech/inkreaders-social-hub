// app/create/pack/PromptBar.tsx
"use client";

import React from "react";

type Props = {
  prompt: string;
  setPrompt: (v: string) => void;
  busy?: boolean;
  onGenerateExplanation: () => Promise<void>;
  onBuildPack: () => Promise<void>;
  onCreateQuiz: () => Promise<void>;
  examples?: string[];
};

export default function PromptBar({
  prompt,
  setPrompt,
  busy,
  onGenerateExplanation,
  onBuildPack,
  onCreateQuiz,
  examples = [
    "Generate a pack on the history of the internet",
    "Explain quantum computing for beginners",
    "Build a weekly current affairs pack on India",
  ],
}: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <label className="sr-only">Pack prompt</label>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder='Try: "Generate a pack on the history of the internet"'
        className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onBuildPack();
          }
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button
          onClick={onGenerateExplanation}
          disabled={busy}
          className="rounded-full border px-4 py-2 text-sm bg-white hover:bg-gray-50"
          aria-label="Generate explanation"
        >
          Explain
        </button>

        <button
          onClick={onBuildPack}
          disabled={busy}
          className="rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
          aria-label="Build pack"
        >
          {busy ? "Building…" : "Build Pack"}
        </button>

        <button
          onClick={onCreateQuiz}
          disabled={busy}
          className="rounded-full border px-4 py-2 text-sm bg-white hover:bg-gray-50"
          aria-label="Create quiz"
        >
          Create Quiz
        </button>

        <div className="ml-auto text-sm text-gray-500">
          Examples:
          <span className="ml-2 text-xs text-gray-400">
            {examples.slice(0, 2).join(" • ")}
          </span>
        </div>
      </div>
    </div>
  );
}

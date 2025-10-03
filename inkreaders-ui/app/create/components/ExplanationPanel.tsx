// app/create/components/ExplanationPanel.tsx
"use client";

import React, { useState } from "react";
import { useToast } from "@/app/components/util/ToastProvider";
import { API_BASE as GLOBAL_API_BASE } from "@/app/create/lib/api";
import { apiFetchJson } from "@/lib/api";

const API_BASE = GLOBAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Props = {
  questionId: string;
  prompt: string; // combined context: prompt + options + answer
  answer?: string | null;
  // optional callback to persist explanation locally if you add that later
  onSaveExplanation?: (questionId: string, explanation: string) => void;
};

export default function ExplanationPanel({ questionId, prompt, answer, onSaveExplanation }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchExplanation() {
    // toggle if already fetched
    if (explanation) {
      setOpen((v) => !v);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      
      const body = { question_id: questionId, prompt, answer: answer ?? null };
      const res = await fetch(`${API_BASE}/api/exercises/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to generate explanation");
      }

      const data = await apiFetchJson<{ explanation: string }>("/api/exercises/explain", {
      method: "POST",
      body: JSON.stringify(body),
    });
      const text = data?.explanation || "No explanation returned.";
      setExplanation(text);
      setOpen(true);

      // optional: notify
      push({ variant: "success", message: "Explanation generated" });

      // optional: persist via callback
      if (onSaveExplanation) onSaveExplanation(questionId, text);
    } catch (err: any) {
      console.error("explain error:", err);
      setError(err?.message ?? "Error generating explanation");
      push({ variant: "error", title: "Explain failed", message: err?.message ?? "Try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={fetchExplanation}
          className="rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
          aria-pressed={open}
          aria-label="Explain answer using AI"
        >
          {loading ? "Explaining…" : explanation ? (open ? "Hide explanation" : "Show explanation") : "Explain answer (AI)"}
        </button>

        {error && <div className="text-sm text-red-600">Error</div>}
      </div>

      {open && (
        <div
          className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap"
          role="region"
          aria-live="polite"
        >
          {loading ? "Generating explanation…" : explanation}
        </div>
      )}
    </div>
  );
}

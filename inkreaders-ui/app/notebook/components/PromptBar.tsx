// app/notebook/components/PromptBar.tsx
"use client";

import { useState } from "react";

export default function PromptBar({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSubmit(query);
    setQuery("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 rounded-xl border border-gray-300 bg-white p-3 shadow"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask anything… e.g., Basics of Statistics"
        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
      />
      <button
        type="submit"
        className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-white font-medium hover:opacity-90"
      >
        Ask
      </button>
    </form>
  );
}

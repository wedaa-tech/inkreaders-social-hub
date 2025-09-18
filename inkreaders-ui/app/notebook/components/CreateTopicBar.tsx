// app/notebook/CreateTopicBar.tsx
"use client";

import { useState } from "react";

export default function CreateTopicBar({ onCreated }: { onCreated: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: prompt,
          prompt,
          tags: [],
          meta: { visibility: "private" },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onCreated(data.topic.id);
      setPrompt("");
    } catch (err) {
      console.error("Create topic failed", err);
      alert("Failed to create topic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl shadow p-2">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Start a new topic..."
        className="flex-1 border-none focus:ring-0 text-sm px-2"
        disabled={loading}
      />
      <button
        onClick={handleCreate}
        disabled={loading || !prompt.trim()}
        className="px-3 py-1 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create"}
      </button>
    </div>
  );
}

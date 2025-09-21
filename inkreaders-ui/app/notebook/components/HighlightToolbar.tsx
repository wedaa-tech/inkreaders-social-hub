// app/notebook/components/HighlightToolbar.tsx
"use client";

import { useState } from "react";
import { mutate } from "swr";

export default function HighlightToolbar({
  topicId,
  responseId,
  selection,
  onCreated,
  colors = ["#FEF3C7", "#D1FAE5", "#DBEAFE", "#FCE7F3", "#F3F4F6"],
}: {
  topicId: string;
  responseId: string;
  selection: string;
  onCreated: () => void;
  colors?: string[];
}) {
  const [note, setNote] = useState("");
  const [color, setColor] = useState(colors[0] || "#FEF3C7");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selection.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/topics/${topicId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          response_id: responseId,
          excerpt: selection,
          color,
          note: note?.trim() || null,
          context_snippet: selection.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      // refresh InspectorPanel + inline highlights
      mutate(`/api/topics/${topicId}/highlights`);
      onCreated();
    } catch (err) {
      console.error("Failed to save highlight:", err);
      alert("Failed to save highlight");
    } finally {
      setSaving(false);
      setNote("");
    }
  }

  return (
    <div className="rounded-lg bg-white border shadow-md p-3 w-72 space-y-3">
      <div className="text-xs text-gray-600 line-clamp-2">"{selection}"</div>

      {/* Color picker */}
      <div className="flex gap-2">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border ${
              color === c ? "ring-2 ring-offset-1 ring-blue-500" : ""
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Highlight color ${c}`}
          />
        ))}
      </div>

      {/* Note input */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)…"
        rows={2}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded bg-blue-600 text-white py-1 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Highlight"}
      </button>
    </div>
  );
}

// app/notebook/components/HighlightToolbar.tsx
"use client";

import { useState, useEffect } from "react";

type HighlightToolbarProps = {
  topicId: string;
  responseId: string;
  selection: string;
  onCreated: () => void; // callback to refresh InspectorPanel
};

export default function HighlightToolbar({
  topicId,
  responseId,
  selection,
  onCreated,
}: HighlightToolbarProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selection) {
      setPos(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, [selection]);

  if (!selection || !pos) return null;

  async function createHighlight(color: string, note?: string) {
    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        topic_id: topicId,
        response_id: responseId,
        excerpt: selection,
        color,
        note,
      }),
    });
    onCreated();
  }

  return (
    <div
      className="fixed z-50 flex gap-2 rounded-lg bg-gray-900 px-2 py-1 text-white shadow-md"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        className="px-2 py-1 text-xs hover:bg-yellow-500 rounded"
        onClick={() => createHighlight("yellow")}
      >
        🟡
      </button>
      <button
        className="px-2 py-1 text-xs hover:bg-green-500 rounded"
        onClick={() => createHighlight("green")}
      >
        🟢
      </button>
      <button
        className="px-2 py-1 text-xs hover:bg-red-500 rounded"
        onClick={() => createHighlight("red")}
      >
        🔴
      </button>
      <button
        className="px-2 py-1 text-xs hover:bg-gray-700 rounded"
        onClick={() => {
          const note = prompt("Enter a note:");
          if (note) createHighlight("yellow", note);
        }}
      >
        📝
      </button>
    </div>
  );
}

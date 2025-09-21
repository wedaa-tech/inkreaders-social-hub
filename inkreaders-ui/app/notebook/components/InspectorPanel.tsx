// app/notebook/components/InspectorPanel.tsx
"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export default function InspectorPanel({ topicId }: { topicId: string }) {
  const { data, error, isLoading } = useSWR(
    topicId ? `/api/topics/${topicId}/highlights` : null,
    fetcher
  );

  async function handleUpdate(id: string, updates: any) {
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      mutate(`/api/topics/${topicId}/highlights`);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update highlight");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this highlight?")) return;
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      mutate(`/api/topics/${topicId}/highlights`);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete highlight");
    }
  }

  if (isLoading) return <div className="text-gray-400">Loading highlights…</div>;
  if (error) return <div className="text-red-500">Failed to load highlights</div>;

  const highlights = data || [];

  return (
    <div className="rounded-lg border bg-white shadow-sm p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Highlights & Notes</h3>

      {highlights.length === 0 && (
        <p className="text-sm text-gray-400">No highlights yet</p>
      )}

      {highlights.map((h: any) => (
        <HighlightItem
          key={h.id}
          highlight={h}
          onUpdate={(updates) => handleUpdate(h.id, updates)}
          onDelete={() => handleDelete(h.id)}
        />
      ))}
    </div>
  );
}

function HighlightItem({
  highlight,
  onUpdate,
  onDelete,
}: {
  highlight: any;
  onUpdate: (updates: any) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight.note || "");
  const [color, setColor] = useState(highlight.color || "yellow");

  const save = () => {
    onUpdate({ note, color });
    setEditing(false);
  };

  return (
    <div
      className="rounded border p-3 text-sm"
      style={{ backgroundColor: highlight.color || "yellow" }}
    >
      <p className="font-medium text-gray-800">“{highlight.excerpt}”</p>

      {editing ? (
        <div className="space-y-2 mt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            {["yellow", "green", "red"].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border ${
                  color === c ? "ring-2 ring-offset-1 ring-blue-500" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="px-2 py-1 rounded bg-blue-600 text-white text-xs"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 rounded bg-gray-200 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {highlight.note && (
            <p className="mt-1 text-gray-700">Note: {highlight.note}</p>
          )}
          <div className="flex gap-3 mt-2 text-xs">
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// app/notebook/components/InspectorPanel.tsx
"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export default function InspectorPanel({
  topicId,
}: {
  topicId: string | null;
}) {
  const { data, error, isLoading } = useSWR(
    topicId ? `/api/topics/${topicId}/highlights` : null,
    fetcher
  );

  if (!topicId) {
    return (
      <div className="text-sm text-gray-400 p-4">Select a topic to inspect</div>
    );
  }
  if (isLoading) return <div className="p-4 text-sm">Loading highlights…</div>;
  if (error)
    return (
      <div className="p-4 text-sm text-red-500">
        Failed to load highlights
      </div>
    );

  const highlights = data || [];

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
      console.error("Failed to delete highlight:", err);
      alert("Delete failed");
    }
  }

  async function handleUpdate(id: string, color: string, note: string) {
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ color, note }),
      });
      if (!res.ok) throw new Error(await res.text());
      mutate(`/api/topics/${topicId}/highlights`);
    } catch (err) {
      console.error("Failed to update highlight:", err);
      alert("Update failed");
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm p-4 space-y-3">
      <h3 className="text-lg font-semibold">Inspector</h3>

      {highlights.length === 0 && (
        <div className="text-sm text-gray-400">No highlights yet</div>
      )}

      <ul className="space-y-3">
        {highlights.map((h: any) => (
          <HighlightItem
            key={h.id}
            h={h}
            onDelete={() => handleDelete(h.id)}
            onSave={(color, note) => handleUpdate(h.id, color, note)}
          />
        ))}
      </ul>
    </div>
  );
}

// --- Sub-component for inline editing ---
function HighlightItem({
  h,
  onDelete,
  onSave,
}: {
  h: any;
  onDelete: () => void;
  onSave: (color: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(h.note || "");
  const [color, setColor] = useState(h.color);

  function handleSave() {
    onSave(color, note);
    setEditing(false);
  }

  return (
    <li className="border rounded-md p-2 bg-gray-50 text-sm space-y-1">
      <div>
        <span
          className="px-1 rounded"
          style={{ backgroundColor: color }}
        >
          {h.excerpt}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            {["yellow", "green", "red"].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border ${
                  color === c ? "ring-2 ring-offset-1 ring-blue-500" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSave}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs border rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {note && <div className="text-gray-700">{note}</div>}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-500 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

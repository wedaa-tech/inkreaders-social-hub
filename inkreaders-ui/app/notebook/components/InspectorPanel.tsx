// app/notebook/components/InspectorPanel.tsx
"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

const PASTEL_COLORS = ["#FEF3C7", "#D1FAE5", "#DBEAFE", "#FCE7F3", "#F3F4F6"];

export default function InspectorPanel({
  topicId,
  onJumpToHighlight,
}: {
  topicId: string | null;
  onJumpToHighlight?: (id: string) => void;
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
      <h3 className="text-lg font-semibold">Note Highlights</h3>

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
            onJump={() => onJumpToHighlight?.(h.id)}
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
  onJump,
}: {
  h: any;
  onDelete: () => void;
  onSave: (color: string, note: string) => void;
  onJump?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(h.note || "");
  const [color, setColor] = useState(h.color || PASTEL_COLORS[0]);

  function handleSave() {
    onSave(color, note);
    setEditing(false);
  }

  return (
    <li className="border rounded-md p-2 bg-gray-50 text-sm space-y-1">
      <div className="flex items-start gap-3">
        {/* Color swatch */}
        <div
          aria-hidden
          className="h-6 w-6 rounded-sm border"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1">
          {/* Clickable excerpt to jump */}
          <div
            className="font-medium cursor-pointer hover:underline"
            onClick={onJump}
          >
            {h.excerpt}
          </div>
          {h.context_snippet && (
            <div className="text-xs text-gray-500 line-clamp-2">
              {h.context_snippet}
            </div>
          )}

          {/* Note display / edit */}
          {!editing ? (
            h.note && <div className="text-gray-700 mt-1">{h.note}</div>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1 text-sm mt-1"
              placeholder="Edit note…"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {!editing ? (
            <>
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
            </>
          ) : (
            <div className="flex flex-col items-end gap-2">
              {/* Color picker */}
              <div className="flex gap-2">
                {PASTEL_COLORS.map((c) => (
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
              <div className="flex gap-2">
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
          )}
        </div>
      </div>
    </li>
  );
}

// app/notebook/components/InspectorPanel.tsx
"use client";

import useSWR from "swr";
import { useState } from "react";

type Highlight = {
  id: string;
  excerpt: string;
  color: string;
  note?: string;
  created_at?: string;
};

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export default function InspectorPanel({ topicId }: { topicId: string | null }) {
  const { data, error, isLoading, mutate } = useSWR<Highlight[]>(
    topicId ? `/api/topics/${topicId}/highlights` : null,
    fetcher
  );

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!topicId) {
    return (
      <aside className="hidden md:block w-72 border-l border-gray-200 p-4 text-gray-500">
        Select a topic to inspect
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="hidden md:block w-72 border-l border-gray-200 p-4 text-red-500">
        Failed to load highlights
      </aside>
    );
  }

  const highlights = data || [];

  async function saveNote(id: string) {
    await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ note: draft }),
    });
    setEditing(null);
    setDraft("");
    mutate();
  }

  async function deleteHighlight(id: string) {
    await fetch(`/api/highlights/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    mutate();
  }

  return (
    <aside className="hidden md:block w-72 border-l border-gray-200 p-4 bg-gray-50 overflow-y-auto">
      <h2 className="font-semibold mb-4">Inspector</h2>

      {isLoading && <p className="text-gray-400">Loading highlights…</p>}

      {highlights.length === 0 && !isLoading && (
        <p className="text-gray-400 text-sm">No highlights yet</p>
      )}

      <ul className="space-y-3">
        {highlights.map((h) => (
          <li
            key={h.id}
            className="rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-sm"
          >
            <div className="mb-1">
              <span
                className={`inline-block rounded px-1 ${
                  h.color === "yellow"
                    ? "bg-yellow-200"
                    : h.color === "green"
                    ? "bg-green-200"
                    : "bg-red-200"
                }`}
              >
                {h.excerpt}
              </span>
            </div>

            {editing === h.id ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full rounded border border-gray-300 p-1 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveNote(h.id)}
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs px-2 py-1 bg-gray-200 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <p className="text-gray-700">
                  {h.note || <span className="text-gray-400">No note</span>}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(h.id);
                      setDraft(h.note || "");
                    }}
                    className="text-xs text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteHighlight(h.id)}
                    className="text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

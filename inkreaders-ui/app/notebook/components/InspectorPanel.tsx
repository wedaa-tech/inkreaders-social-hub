// app/notebook/components/InspectorPanel.tsx
"use client";

import { useState } from "react";
import { Section, Tag } from "../page";

export default function InspectorPanel({
  section,
  onUpdate,
}: {
  section: Section | null;
  onUpdate: (update: Partial<Section>) => void;
}) {
  const [tagInput, setTagInput] = useState("");

  if (!section) {
    return (
      <div className="p-4 text-gray-500">
        <p className="text-sm">Select a section to see details here →</p>
      </div>
    );
  }

  const addTag = () => {
    if (tagInput.trim()) {
      const newTag: Tag = { id: crypto.randomUUID(), label: tagInput.trim() };
      onUpdate({ tags: [...section.tags, newTag] });
    }
    setTagInput("");
  };

  const removeTag = (id: string) => {
    onUpdate({ tags: section.tags.filter((t) => t.id !== id) });
  };

  const removeHighlight = (id: string) => {
    onUpdate({
      highlights: section.highlights.filter((h) => h.id !== id),
    });
  };

  const addNote = (id: string, note: string) => {
    onUpdate({
      highlights: section.highlights.map((h) =>
        h.id === id ? { ...h, note } : h
      ),
    });
  };

  const generatePractice = () => {
    // For now, mock → later call /api/exercises/generate with section.body
    alert(`TODO: Generate practice for: ${section.title}`);
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">{section.title}</h3>

      {/* Tags */}
      <div>
        <h4 className="font-medium text-sm">Tags</h4>
        <div className="flex gap-2 mt-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add tag…"
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={addTag}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
          >
            Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {section.tags.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs"
            >
              #{t.label}
              <button
                onClick={() => removeTag(t.id)}
                className="ml-1 text-red-500 hover:underline"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Highlights */}
      <div>
        <h4 className="font-medium text-sm">Highlights</h4>
        {section.highlights.length === 0 ? (
          <p className="text-sm text-gray-500">No highlights yet.</p>
        ) : (
          <ul className="space-y-2">
            {section.highlights.map((h) => (
              <li key={h.id} className="text-sm">
                <div className="flex justify-between items-center">
                  <span
                    className={`px-1 rounded ${
                      h.color === "yellow"
                        ? "bg-yellow-200"
                        : h.color === "green"
                        ? "bg-green-200"
                        : "bg-red-200"
                    }`}
                  >
                    {h.text}
                  </span>
                  <button
                    onClick={() => removeHighlight(h.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  placeholder="Add note…"
                  defaultValue={h.note}
                  onBlur={(e) => addNote(h.id, e.target.value)}
                  className="mt-1 block w-full rounded border px-2 py-1 text-xs"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ✅ Practice Generator */}
      <div className="pt-4 border-t">
        <button
          onClick={generatePractice}
          className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          ⚡ Generate Practice
        </button>
      </div>
    </div>
  );
}

// app/create/pack/SectionCard.tsx
"use client";

import React from "react";
import { Section } from "./types";

type Props = {
  section: Section;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAutoQuiz: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
};

export default function SectionCard({ section, onEdit, onRemove, onAutoQuiz, onMoveUp, onMoveDown }: Props) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-800">{section.title}</div>
            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">{section.kind || "freeform"}</span>
          </div>
          <div className="mt-2 text-sm text-gray-700 whitespace-pre-line">{section.body}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button onClick={() => onEdit(section.id)} className="rounded-full border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">Edit</button>
            <button onClick={() => onAutoQuiz(section.id)} className="rounded-full border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">Auto-quiz</button>
            <button onClick={() => onRemove(section.id)} className="rounded-full border px-3 py-1 text-xs text-red-600 hover:bg-red-50">Remove</button>
          </div>

          <div className="flex gap-1">
            <button onClick={() => onMoveUp(section.id)} className="rounded-full border px-2 py-1 text-xs">↑</button>
            <button onClick={() => onMoveDown(section.id)} className="rounded-full border px-2 py-1 text-xs">↓</button>
          </div>
        </div>
      </div>
    </article>
  );
}

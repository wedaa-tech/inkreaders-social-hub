// app/create/pack/PackCanvas.tsx
"use client";

import React from "react";
import { Section } from "./types";
import SectionCard from "./SectionCard";

type Props = {
  sections: Section[];
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAutoQuiz: (id: string) => void;
  onReorder: (newSections: Section[]) => void;
};

export default function PackCanvas({ sections, onEdit, onRemove, onAutoQuiz, onReorder }: Props) {
  function moveIndex(id: string, delta: number) {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, moved);
    onReorder(copy);
  }

  return (
    <div className="space-y-4">
      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
          No sections yet — build a pack to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              onEdit={onEdit}
              onRemove={onRemove}
              onAutoQuiz={onAutoQuiz}
              onMoveUp={() => moveIndex(s.id, -1)}
              onMoveDown={() => moveIndex(s.id, +1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

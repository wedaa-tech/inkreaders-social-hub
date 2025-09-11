// app/notebook/components/NotebookCanvas.tsx
"use client";

import SectionCard from "@/app/notebook/components/SectionCard";
import { Section } from "@/app/notebook/page";

export default function NotebookCanvas({
  sections,
  onSelectSection,
  onUpdate,
}: {
  sections: Section[];
  onSelectSection: (s: Section) => void;
  onUpdate: (id: string, update: Partial<Section>) => void;
}) {
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
        Start by asking a question above 👆
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <SectionCard
          key={s.id}
          section={s}
          onClick={() => onSelectSection(s)}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

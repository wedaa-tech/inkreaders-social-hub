// app/notebook/page.tsx
"use client";

import { useState } from "react";
import Shell from "@/app/components/Shell";
import PromptBar from "@/app/notebook/components/PromptBar";
import NotebookCanvas from "@/app/notebook/components/NotebookCanvas";
import InspectorPanel from "@/app/notebook/components/InspectorPanel";

export type Tag = {
  id: string;
  label: string;
};

export type Highlight = {
  id: string;
  text: string;
  color: "yellow" | "green" | "red";
  note?: string;
};

export type Section = {
  id: string;
  title: string;
  body: string;
  tags: Tag[];
  highlights: Highlight[];
};

export default function NotebookPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleSubmit = (query: string) => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      title: `AI Response for: ${query}`,
      body: `This is a mock response for "${query}".`,
      tags: [],
      highlights: [],
    };
    setSections((prev) => [...prev, newSection]);
  };

  const updateSection = (id: string, update: Partial<Section>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...update } : s))
    );
  };

  const activeSection = sections.find((s) => s.id === activeId) || null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Shell
        right={
          <InspectorPanel
            section={activeSection}
            onUpdate={(update) => {
              if (activeId) updateSection(activeId, update);
            }}
          />
        }
      >
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <h1 className="text-3xl font-bold">📒 Notebook</h1>
          <PromptBar onSubmit={handleSubmit} />
          <NotebookCanvas
            sections={sections}
            onSelectSection={(s) => setActiveId(s.id)}
            onUpdate={updateSection}
          />
        </div>
      </Shell>
    </main>
  );
}

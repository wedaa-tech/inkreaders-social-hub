// app/notebook/components/NotebookCanvas.tsx
"use client";

import SectionCard from "@/app/notebook/components/SectionCard";

export type Response = {
  id: string;
  content: string;
  content_html?: string;
  authorType?: "ai" | "user";
  createdAt?: string;
  updatedAt?: string;
};

export default function NotebookCanvas({
  responses,
  onSelectResponse,
}: {
  responses: Response[];
  onSelectResponse: (r: Response) => void;
}) {
  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
        Start by asking a question above 👆
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((r) => (
        <SectionCard
          key={r.id}
          response={r}
          onClick={() => onSelectResponse(r)}
        />
      ))}
    </div>
  );
}

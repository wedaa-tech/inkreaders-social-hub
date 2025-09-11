// app/notebook/components/SectionCard.tsx
"use client";

import { Section, Highlight, Tag } from "../page";
import HighlightToolbar from "./HighlightToolbar";

export default function SectionCard({
  section,
  onClick,
  onUpdate,
}: {
  section: Section;
  onClick: () => void;
  onUpdate: (id: string, update: Partial<Section>) => void;
}) {
  const addHighlight = (color: Highlight["color"]) => {
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString().trim();
    if (!text) return;

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      text,
      color,
    };

    onUpdate(section.id, {
      highlights: [...section.highlights, newHighlight],
    });

    sel.removeAllRanges();
  };

  // ✅ Render highlights inline
  const renderBody = () => {
    let html = section.body;
    section.highlights.forEach((h) => {
      const colorClass =
        h.color === "yellow"
          ? "bg-yellow-200"
          : h.color === "green"
          ? "bg-green-200"
          : "bg-red-200";

      // Replace only first occurrence to avoid replacing everywhere
      html = html.replace(
        h.text,
        `<mark class="rounded px-1 ${colorClass}">${h.text}</mark>`
      );
    });
    return { __html: html };
  };

  return (
    <article
      className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      <h2 className="text-lg font-semibold">{section.title}</h2>

      <p
        className="mt-2 text-gray-700 whitespace-pre-wrap"
        dangerouslySetInnerHTML={renderBody()}
      />

      {/* Floating Toolbar */}
      <HighlightToolbar
        onAction={(action) => {
          if (action === "yellow" || action === "green" || action === "red") {
            addHighlight(action);
          } else if (action === "tag") {
            const newTag: Tag = { id: crypto.randomUUID(), label: "New Tag" };
            onUpdate(section.id, {
              tags: [...section.tags, newTag],
            });
          } else if (action === "note") {
            alert("TODO: attach note to selection");
          }
        }}
      />
    </article>
  );
}

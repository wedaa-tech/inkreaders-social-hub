// app/notebook/components/ResponseCard.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import HighlightToolbar from "./HighlightToolbar";

export default function ResponseCard({
  resp,
  topicId,
  onHighlightCreated,
}: {
  resp: any;
  topicId: string;
  onHighlightCreated: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  // Watch mouseup for text selection
  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection("");
        setSelectionRect(null);
        return;
      }
      if (!containerRef.current?.contains(sel.anchorNode)) return;

      const text = sel.toString().trim();
      if (!text) return;

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection(text);
      setSelectionRect(rect);
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Render markdown with inline highlights
  function renderWithHighlights(content: string) {
    if (!resp.highlights || resp.highlights.length === 0) return content;

    let out = content;
    resp.highlights.forEach((h: any) => {
      if (h.excerpt) {
        const safeExcerpt = h.excerpt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(safeExcerpt, "i");
        out = out.replace(regex, `<mark>${h.excerpt}</mark>`);
      }
    });
    return out;
  }

  return (
    <div ref={containerRef} className="relative rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>{resp.authorType === "ai" ? "AI" : "You"}</span>
        <span>{new Date(resp.createdAt).toLocaleString()}</span>
      </div>

      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {renderWithHighlights(resp.content || "")}
        </ReactMarkdown>
      </div>

      {/* Floating toolbar for highlights */}
      {selection && selectionRect && (
        <div
          className="absolute z-50"
          style={{
            top:
              selectionRect.top -
              (containerRef.current?.getBoundingClientRect().top || 0) -
              48,
            left:
              selectionRect.left -
              (containerRef.current?.getBoundingClientRect().left || 0),
          }}
        >
          <HighlightToolbar
            topicId={topicId}
            responseId={resp.id}
            selection={selection}
            onCreated={() => {
              setSelection("");
              setSelectionRect(null);
              onHighlightCreated();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ResponseCard.tsx
import React, { useEffect, useRef, useState } from "react";

type Response = {
  id: string;
  content_html: string;
  created_at: string;
  author_type: "ai" | "user";
};

export default function ResponseCard({ resp }: { resp: Response }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      // ensure selection is inside this response container
      const anchorNode = sel.anchorNode;
      if (!anchorNode) return;
      if (!el.contains(anchorNode)) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelectedText(null);
        setSelectionRect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionRect(rect);
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  function onCreateHighlight(color = "yellow") {
    if (!selectedText) return;
    // POST /api/highlights { topic_id, response_id:resp.id, excerpt: selectedText, color }
    fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_id: resp.id,
        excerpt: selectedText,
        color,
      }),
    }).then(() => {
      // optimistic UI: clear selection and maybe show toast
      setSelectedText(null);
      setSelectionRect(null);
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-gray-500">{resp.author_type === "ai" ? "AI" : "You"}</div>
        <div className="text-xs text-gray-400">{new Date(resp.created_at).toLocaleString()}</div>
      </div>

      <div
        ref={containerRef}
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: resp.content_html }}
      />

      {selectedText && selectionRect && (
        <div
          style={{
            position: "fixed",
            left: selectionRect.left + window.scrollX,
            top: selectionRect.top + window.scrollY - 44,
            transform: "translateY(-8px)",
            zIndex: 2000,
          }}
        >
          <div className="bg-gray-900 text-white rounded-md p-2 flex gap-2">
            <button className="px-2 py-1 text-sm" onClick={() => onCreateHighlight("yellow")}>Highlight</button>
            <button className="px-2 py-1 text-sm" onClick={() => onCreateHighlight("green")}>Note</button>
            <button
              className="px-2 py-1 text-sm"
              onClick={() => {
                // generate practice from selection
                fetch("/api/generate/practice", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: selectedText, style: "flashcards" })
                });
                setSelectedText(null);
                setSelectionRect(null);
              }}
            >
              Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

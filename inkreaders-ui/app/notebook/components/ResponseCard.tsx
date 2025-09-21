// app/notebook/components/ResponseCard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
  const [selection, setSelection] = useState<string>("");

  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection("");
        return;
      }
      const text = sel.toString().trim();
      if (text && containerRef.current?.contains(sel.anchorNode)) {
        setSelection(text);
      } else {
        setSelection("");
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-gray-200 bg-white p-4 shadow hover:shadow-md transition"
    >
      <div className="flex justify-between mb-2">
        <span className="text-xs text-gray-500">
          {resp.status === "pending"
            ? "⏳ Generating…"
            : resp.authorType === "ai"
            ? "AI"
            : "You"}
        </span>
        {resp.createdAt && (
          <span className="text-xs text-gray-400">
            {new Date(resp.createdAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {resp.content || ""}
        </ReactMarkdown>
      </div>

      {selection && (
        <HighlightToolbar
          topicId={topicId}
          responseId={resp.id}
          selection={selection}
          onCreated={onHighlightCreated}
        />
      )}
    </div>
  );
}

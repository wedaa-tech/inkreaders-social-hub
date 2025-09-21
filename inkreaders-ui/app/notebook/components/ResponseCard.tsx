// app/notebook/components/ResponseCard.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import useSWR, { mutate } from "swr";
import HighlightToolbar from "./HighlightToolbar";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

const PASTEL_COLORS = ["#FEF3C7", "#D1FAE5", "#DBEAFE", "#FCE7F3", "#F3F4F6"];

function buildHtmlTolerantRegex(excerpt: string): RegExp {
  const trimmed = excerpt.trim();
  if (trimmed === "") return new RegExp("$^");
  function escChar(c: string) {
    return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  let pattern = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < trimmed.length && /\s/.test(trimmed[j])) j++;
      pattern += `(?:<[^>]+>)*\\s+(?:<[^>]+>)*`;
      i = j - 1;
    } else {
      pattern += escChar(ch) + `(?:<[^>]+>)*`;
    }
  }
  return new RegExp(pattern, "gi");
}

export default function ResponseCard({
  resp,
  topicId,
  onHighlightCreated,
}: {
  resp: any;
  topicId: string;
  onHighlightCreated?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const [selection, setSelection] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<any | null>(null);

  const { data: highlightsData } = useSWR(
    topicId ? `/api/topics/${topicId}/highlights` : null,
    fetcher
  );
  const highlights = Array.isArray(highlightsData) ? highlightsData : [];

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      if (
        toolbarRef.current &&
        e.target instanceof Node &&
        toolbarRef.current.contains(e.target)
      ) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection("");
        setSelectionRect(null);
        return;
      }
      if (!containerRef.current?.contains(sel.anchorNode)) {
        setSelection("");
        setSelectionRect(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection("");
        setSelectionRect(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection(text);
      setSelectionRect(rect);
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  function injectHighlightsInto(text: string) {
    if (!Array.isArray(highlights) || highlights.length === 0) return text;
    const uniq = new Map<string, any>();
    for (const h of highlights) {
      if (h && h.response_id === resp.id && h.excerpt) {
        const key = `${h.excerpt}::${h.color}::${h.response_id}`;
        uniq.set(key, h);
      }
    }
    if (uniq.size === 0) return text;

    const sorted = Array.from(uniq.values()).sort(
      (a: any, b: any) => (b.excerpt?.length || 0) - (a.excerpt?.length || 0)
    );

    let out = text;
    for (const h of sorted) {
      try {
        const re = buildHtmlTolerantRegex(String(h.excerpt || ""));
        out = out.replace(
          re,
          (match) =>
            `<mark data-hid="${h.id}" style="background:${h.color}; padding:0.05em 0.15em; border-radius:0.18em">${match}</mark>`
        );
      } catch (err) {
        console.warn("highlight injection failed for:", h.excerpt, err);
      }
    }
    return out;
  }

  const hasHTML = Boolean(resp?.content_html && String(resp.content_html).trim() !== "");
  const sourceText = hasHTML ? String(resp.content_html) : String(resp.content || "");

  const renderedWithMarks = useMemo(() => {
    return injectHighlightsInto(sourceText);
  }, [sourceText, JSON.stringify(highlights)]);

  async function saveHighlightEdit(id: string, color: string, note: string) {
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ color, note }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingHighlight(null);
      mutate(`/api/topics/${topicId}/highlights`);
    } catch (err) {
      console.error("saveHighlightEdit failed:", err);
      alert("Failed to save highlight edit");
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border bg-white p-4 shadow-sm"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target && target.tagName === "MARK" && target.dataset.hid) {
          const hid = target.dataset.hid;
          const found = highlights.find((x: any) => x.id === hid);
          if (found) setEditingHighlight(found);
        }
      }}
    >
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>{resp?.authorType === "ai" ? "AI" : "You"}</span>
        <span>{resp?.createdAt ? new Date(resp.createdAt).toLocaleString() : ""}</span>
      </div>

      {hasHTML ? (
        <div
          className="markdown prose max-w-none"
          dangerouslySetInnerHTML={{ __html: renderedWithMarks }}
        />
      ) : (
        <div className="markdown prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {renderedWithMarks}
          </ReactMarkdown>
        </div>
      )}

      {selection && selectionRect && (
        <div
          ref={toolbarRef}
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
              mutate(`/api/topics/${topicId}/highlights`);
              onHighlightCreated?.(); // ✅ notify parent if provided
            }}
            colors={PASTEL_COLORS}
          />
        </div>
      )}

      {editingHighlight && (
        <div className="absolute z-50 top-4 right-4 bg-white border shadow-md p-3 rounded w-72">
          <h4 className="text-sm font-medium mb-2">Edit Highlight</h4>
          <textarea
            value={editingHighlight.note || ""}
            onChange={(e) =>
              setEditingHighlight({ ...editingHighlight, note: e.target.value })
            }
            rows={2}
            className="w-full border rounded px-2 py-1 text-sm mb-2"
          />
          <div className="flex gap-2 mb-2">
            {PASTEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setEditingHighlight({ ...editingHighlight, color: c })
                }
                className={`h-6 w-6 rounded-full border ${
                  editingHighlight.color === c ? "ring-2 ring-offset-1 ring-blue-500" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() =>
                saveHighlightEdit(
                  editingHighlight.id,
                  editingHighlight.color,
                  editingHighlight.note || ""
                )
              }
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
            >
              Save
            </button>
            <button
              onClick={() => setEditingHighlight(null)}
              className="px-3 py-1 text-xs border rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

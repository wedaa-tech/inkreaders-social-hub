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

export default function ResponseCard({
  resp,
  topicId,
}: {
  resp: any;
  topicId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const [selection, setSelection] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<any | null>(null);

  // Fetch highlights for this topic (shared SWR key with InspectorPanel)
  const { data: highlightsData } = useSWR(
    topicId ? `/api/topics/${topicId}/highlights` : null,
    fetcher
  );
  const highlights = Array.isArray(highlightsData) ? highlightsData : [];

  // Keep toolbar open when clicking inside it; compute selection on mouseup
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // If clicking inside toolbar, don't clear selection
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
      // ensure selection is inside this card
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

  // Helper: escape regex special chars and allow flexible whitespace
  function escapeForRegex(s: string) {
    // First escape regex specials
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Then convert runs of whitespace into \s+ to match flexible spacing
    return escaped.replace(/\s+/g, "\\s+");
  }

  // Inject <mark> tags into the source (markdown or html string).
  // Deduplicate and replace longest excerpts first to avoid substring collisions.
  function injectHighlightsInto(text: string) {
    if (!Array.isArray(highlights) || highlights.length === 0) return text;
    // dedupe by excerpt+color+response_id
    const uniq = new Map<string, any>();
    for (const h of highlights) {
      if (h && h.response_id === resp.id && h.excerpt) {
        const key = `${h.excerpt}::${h.color}::${h.response_id}`;
        uniq.set(key, h);
      }
    }
    if (uniq.size === 0) return text;

    // sort by excerpt length descending (longer first)
    const sorted = Array.from(uniq.values()).sort(
      (a: any, b: any) => (b.excerpt?.length || 0) - (a.excerpt?.length || 0)
    );

    let out = text;
    for (const h of sorted) {
      try {
        const safe = escapeForRegex(String(h.excerpt || ""));
        const re = new RegExp(safe, "gi"); // global, case-insensitive
        out = out.replace(re, (match) =>
          `<mark data-hid="${h.id}" style="background:${h.color}">${match}</mark>`
        );
      } catch (err) {
        // ignore malformed regex or replacement errors for a highlight,
        // continue with remaining highlights (safe fail).
        console.warn("highlight injection failed for excerpt:", h.excerpt, err);
      }
    }
    return out;
  }

  // Choose source: prefer content_html (if present); otherwise markdown content
  const hasHTML = Boolean(resp?.content_html && String(resp.content_html).trim() !== "");
  const sourceText = hasHTML ? String(resp.content_html) : String(resp.content || "");

  // recompute rendered markdown/html whenever resp.content/content_html or highlights change
  const renderedWithMarks = useMemo(() => {
    return injectHighlightsInto(sourceText);
  }, [sourceText, highlights]);

  // Inline edit save
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
      // revalidate highlights
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
      // double-clicking a <mark> opens edit panel
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

      {/* Render: if server gave sanitized HTML, use dangerouslySetInnerHTML (with marks injected).
          Otherwise render Markdown via ReactMarkdown (rehypeRaw allows <mark>).
          Note: server-side sanitization is recommended for content_html to avoid XSS. */}
      {hasHTML ? (
        <div
          className="markdown prose max-w-none"
          // content_html + marks is already HTML
          dangerouslySetInnerHTML={{ __html: renderedWithMarks }}
        />
      ) : (
        <div className="markdown prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {renderedWithMarks}
          </ReactMarkdown>
        </div>
      )}

      {/* Floating highlight toolbar (shown when user selects text) */}
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
              // revalidate highlights
              mutate(`/api/topics/${topicId}/highlights`);
            }}
          />
        </div>
      )}

      {/* Inline edit panel for a highlight (double-click a <mark>) */}
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
            {["yellow", "green", "red"].map((c) => (
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

// app/notebook/components/HighlightToolbar.tsx
"use client";

import { useEffect, useState } from "react";

export default function HighlightToolbar({
  onAction,
}: {
  onAction: (action: "yellow" | "green" | "red" | "tag" | "note") => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  if (!visible || !position) return null;

  return (
    <div
      className="fixed z-50 flex gap-2 rounded-lg bg-white border shadow-md px-2 py-1"
      style={{
        top: position.y,
        left: position.x,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        onClick={() => onAction("yellow")}
        className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 rounded"
      >
        🟡
      </button>
      <button
        onClick={() => onAction("green")}
        className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded"
      >
        🟢
      </button>
      <button
        onClick={() => onAction("red")}
        className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded"
      >
        🔴
      </button>
      <button
        onClick={() => onAction("tag")}
        className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
      >
        # Tag
      </button>
      <button
        onClick={() => onAction("note")}
        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
      >
        📝 Note
      </button>
    </div>
  );
}

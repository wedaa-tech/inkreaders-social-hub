// app/create/pack/InspectorPanel.tsx
"use client";

import React, { useState, useEffect } from "react";
import PreviewCard from "@/app/create/components/PreviewCard"; // re-use your existing preview card path if different adjust
import { Pack } from "./types";

type Props = {
  pack: Pack;
  setPack: (p: Partial<Pack>) => void;
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
};

export default function InspectorPanel({ pack, setPack, onSave, onPublish }: Props) {
  const [tagInput, setTagInput] = useState("");
  useEffect(() => {
    setTagInput("");
  }, [pack.tags.length]);

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (pack.tags.includes(t)) { setTagInput(""); return; }
    setPack({ tags: [...pack.tags, t] });
    setTagInput("");
  }

  function removeTag(t: string) {
    setPack({ tags: pack.tags.filter((x) => x !== t) });
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Pack title</label>
        <input value={pack.title} onChange={(e) => setPack({ title: e.target.value })} className="w-full rounded-lg border px-3 py-2" />

        <label className="block text-sm font-medium text-gray-600 mt-3 mb-1">Focus</label>
        <input value={pack.focus} onChange={(e) => setPack({ focus: e.target.value })} className="w-full rounded-lg border px-3 py-2" />

        <label className="block text-sm font-medium text-gray-600 mt-3 mb-1">Range</label>
        <select value={pack.range} onChange={(e) => setPack({ range: e.target.value as any })} className="w-full rounded-lg border px-3 py-2">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <label className="block text-sm font-medium text-gray-600 mt-3 mb-1">Tags</label>
        <div className="flex gap-2 flex-wrap">
          {pack.tags.map((t) => (
            <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{t} <button onClick={() => removeTag(t)} className="ml-2 text-red-500">×</button></span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag" className="rounded-lg border px-3 py-2 flex-1" />
          <button onClick={addTag} className="rounded-lg bg-gray-50 border px-3 py-2">Add</button>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onSave} className="flex-1 rounded-lg bg-[color:var(--color-brand)] text-white px-4 py-2">Save draft</button>
          <button onClick={onPublish} className="flex-1 rounded-lg bg-white border px-4 py-2">Publish</button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h4 className="font-semibold mb-2">Preview</h4>
        <PreviewCard title={pack.title || "Untitled Pack"} subtitle={`${pack.range || "weekly"} • ${pack.focus || "General"}`} body={pack.sections.map(s => `• ${s.title}`).join("\n")} tags={pack.tags} />
      </div>
    </aside>
  );
}

// app/create/components/StoryComposer.tsx
import React, { useState } from "react";
import { FaMagic } from "@/app/create/components/icons";
import PreviewCard from "@/app/create/components/PreviewCard";
import { usePublish } from "@/app/create/lib/publish"; // if you prefer default import adjust
import { useToast } from "@/app/components/util/ToastProvider";

export default function StoryComposer() {
  const { publishAsNote } = usePublish();
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [audience, setAudience] = useState("General");
  const [body, setBody] = useState("");

  function suggestOutline() {
    const outline = [
      "• Hook: introduce main character and setting.",
      "• Inciting Incident: a small event changes everything.",
      "• Rising Action: 2–3 obstacles escalate stakes.",
      "• Climax: a hard choice with consequences.",
      "• Resolution: tie back to the opening image.",
    ].join("\n");
    setBody((b) => (b ? b + "\n\n" + outline : outline));
    push({ variant: "success", message: "Outline added ✨" });
  }

  function suggestNextParagraph() {
    const snippet = "The library clock chimed again. Outside, rain braided the streetlights; inside, a page turned like a held breath.";
    setBody((b) => (b ? b + "\n\n" + snippet : snippet));
    push({ variant: "success", message: "Paragraph suggested ✍️" });
  }

  const header = `Story: ${title || "(untitled)"}${genre ? ` • ${genre}` : ""} • ${audience}`;
  const excerpt = body.split("\n").slice(0, 12).join("\n");
  const previewText = `${header}\n\n${excerpt}`;
  const tags = ["Story", genre || "Fiction"];

  async function publish() {
    await publishAsNote(`${previewText}\n\n#${tags[0]} #${tags[1]}`);
    setTitle(""); setGenre(""); setAudience("General"); setBody("");
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Write a Story</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre (e.g., Mystery, Sci-Fi)" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent" />
        </div>
        <div className="grid gap-4 mt-4 sm:grid-cols-2">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent">
            <option>General</option><option>Kids</option><option>Young Adult</option><option>Adults</option>
          </select>
          <div className="flex gap-2">
            <button onClick={suggestOutline} className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition" type="button">
              <FaMagic className="mr-2" /> AI: Outline
            </button>
            <button onClick={suggestNextParagraph} className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition" type="button">
              <FaMagic className="mr-2" /> AI: Next paragraph
            </button>
          </div>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Start writing…" className="w-full mt-4 rounded-xl border border-gray-300 p-4 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent" />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => { setTitle(""); setGenre(""); setAudience("General"); setBody(""); }} className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition" type="button">Clear</button>
          <button onClick={publish} className="rounded-xl bg-[color:var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-dark transition" type="button">Publish</button>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner">
        <h4 className="text-xl font-semibold mb-4 text-gray-800">Live Preview</h4>
        <PreviewCard title={title || "(untitled)"} subtitle={genre ? `${genre} • ${audience}` : audience} body={excerpt || "Start typing to see a preview…"} tags={tags} />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/app/components/Shell";
import WhoToFollow from "@/app/components/right/WhoToFollow";
import { TrendingBooks } from "@/app/components/right/TrendingBooks";
import { useToast } from "@/app/components/ToastProvider";
import { normalizeExercise, Exercise as NormalizedExercise } from "@/lib/normalizeExercise";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

/* ----------------------------- Shared utils ----------------------------- */
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function usePublish() {
  const { push } = useToast();
  return {
    async publishAsNote(text: string) {
      if (!text.trim()) {
        push({ variant: "error", title: "Nothing to publish", message: "Add some content first." });
        throw new Error("Nothing to publish");
      }
      try {
        await fetchJson(`/api/bsky/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        push({ variant: "success", message: "Published to timeline ✅" });
      } catch (e: any) {
        push({ variant: "error", title: "Publish failed", message: e?.message ?? "Try again" });
        throw e;
      }
    },
  };
}

/* ----------------------------- Tab Switcher ----------------------------- */
type TabKey = "story" | "exercise" | "pack";

function Tabs({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const base = "rounded-xl px-3 py-1 text-sm transition hover:bg-gray-100";
  const active = "bg-[color:var(--color-brand)] text-white hover:opacity-90";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onChange("story")} className={`${base} ${tab === "story" ? active : ""}`} type="button">✍️ Story</button>
        <button onClick={() => onChange("exercise")} className={`${base} ${tab === "exercise" ? active : ""}`} type="button">📝 Exercise</button>
        <button onClick={() => onChange("pack")} className={`${base} ${tab === "pack" ? active : ""}`} type="button">🌍 Current Affairs Pack</button>
      </div>
    </div>
  );
}

/* ----------------------------- Preview Card ----------------------------- */
function PreviewCard({ title, subtitle, body, tags }: { title: string; subtitle?: string; body: string; tags?: string[] }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white">
      <header className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">You</span>
            <span className="truncate text-sm text-gray-500">@reader.example</span>
            <span className="text-sm text-gray-400">· preview</span>
          </div>
          <div className="mt-1">
            <div className="font-medium">{title}</div>
            {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
          </div>
        </div>
      </header>

      <div className="px-4 pb-4">
        <pre className="whitespace-pre-wrap break-words text-[0.95rem] leading-6 text-gray-800">{body}</pre>
        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full border px-2 py-0.5 text-xs text-gray-600">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-500">
        <div className="flex gap-6">
          <span className="cursor-default">💬 0</span>
          <span className="cursor-default">🔁 0</span>
          <span className="cursor-default">❤️ 0</span>
        </div>
      </div>
    </article>
  );
}

/* --------------------------------- Story Composer --------------------------------- */
function StoryComposer() {
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
    <section className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="font-medium">Write a Story</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre (e.g., Mystery, Sci-Fi)" className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]">
            <option>General</option><option>Kids</option><option>Young Adult</option><option>Adults</option>
          </select>
          <div className="flex gap-2">
            <button onClick={suggestOutline} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" type="button">AI: Outline</button>
            <button onClick={suggestNextParagraph} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" type="button">AI: Next paragraph</button>
          </div>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Start writing…" className="w-full rounded-xl border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
        <div className="flex justify-end gap-2">
          <button onClick={() => { setTitle(""); setGenre(""); setAudience("General"); setBody(""); }} className="rounded-xl px-3 py-2 text-sm hover:bg-gray-50 border" type="button">Clear</button>
          <button onClick={publish} className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90" type="button">Publish</button>
        </div>
      </div>

      {/* Live preview */}
      <PreviewCard title={title || "(untitled)"} subtitle={genre ? `${genre} • ${audience}` : audience} body={excerpt || "Start typing to see a preview…"} tags={tags} />
    </section>
  );
}

/* ----------------------------- Exercise Generator (merged) ----------------------------- */
function ExerciseGenerator() {
  const router = useRouter();
  const { push } = useToast();

  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<NormalizedExercise | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const body = {
      title: form.get("title")?.toString() || "",
      topic: form.get("topic")?.toString() || "",
      formats: [form.get("format")?.toString() || "mcq"],
      count: Number(form.get("count") || 5),
      difficulty: form.get("difficulty")?.toString() || "mixed",
      language: (form.get("language")?.toString() as "en" | "hi") || "en",
      source: { type: "topic" },
    };

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/exercises/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to generate exercise");
      const data = await res.json();
      const normalized = normalizeExercise(data.exercise_set);
      setExercise(normalized);
      setLanguage(body.language);
      push({ variant: "success", message: "Generated exercise preview" });
    } catch (err) {
      console.error(err);
      push({ variant: "error", title: "Generate failed", message: (err as any)?.message || "Try again" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndPreview() {
    if (!exercise) return;

    try {
      const res = await fetch(`${API_BASE}/api/exercises/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ exercise_set: exercise, visibility: "private" }),
      });

      if (!res.ok) throw new Error("Failed to save exercise");
      const data = await res.json();
      const newId = data.id;

      router.push(`/exercises/${newId}/preview`);
    } catch (err) {
      console.error(err);
      push({ variant: "error", title: "Save failed", message: (err as any)?.message || "Could not save exercise" });
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="font-medium">Generate an Exercise</h3>
        <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-4">
          <input name="title" placeholder="Title (optional)" className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] col-span-2" />
          <input name="topic" placeholder="Topic (e.g., Solar System)" required className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
          <select name="format" defaultValue="mcq" className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]">
            <option value="mcq">Multiple Choice</option>
            <option value="true_false">True/False</option>
            <option value="fill_blank">Fill in the Blank</option>
            <option value="match">Matching</option>
          </select>

          <div className="sm:col-span-1">
            <label className="text-sm text-gray-600">Count</label>
            <input name="count" type="number" defaultValue={5} min={1} max={20} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>

          <div>
            <label className="text-sm text-gray-600">Difficulty</label>
            <select name="difficulty" defaultValue="mixed" className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Language</label>
            <select name="language" defaultValue="en" className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          <div className="sm:col-span-4 flex gap-2 mt-2">
            <button type="submit" disabled={loading} className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              {loading ? "Generating…" : "Generate"}
            </button>
            <button type="button" onClick={() => { setExercise(null); push({ variant: "success", message: "Cleared" }); }} className="rounded-xl px-3 py-2 text-sm hover:bg-gray-50 border">Clear</button>
            <button type="button" onClick={handleSaveAndPreview} disabled={!exercise} className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              Save & Continue →
            </button>
          </div>
        </form>

        {/* Preview */}
        {exercise ? (
          <div className="mt-3 rounded-lg border bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{exercise.title || "(untitled)"}</div>
                <div className="text-sm text-gray-600">{exercise.format?.toUpperCase()} • {exercise.difficulty}</div>
              </div>
              <div className="text-sm text-gray-500">Language: {language}</div>
            </div>

            <ul className="space-y-3 mt-3">
              {exercise.questions?.map((q, idx) => (
                <li key={q.id} className="rounded-lg border bg-white p-3">
                  <p className="font-medium">Q{idx + 1}. {q.prompt}</p>
                  {q.options && q.options.length > 0 && (
                    <ul className="ml-4 list-disc text-sm text-gray-600">
                      {q.options.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  )}
                  <p className="text-sm text-green-700 mt-1">Answer: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : typeof q.correctAnswer === "object" ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500">No preview yet — generate to see the exercise.</div>
        )}
      </div>

      {/* Live preview card */}
      <PreviewCard title={exercise ? (exercise.title || "Exercise Preview") : "Exercise Preview"} subtitle={exercise ? `${exercise.format?.toUpperCase()} • ${exercise.difficulty}` : "Provide topic and generate"} body={(exercise ? exercise.questions.slice(0, 6).map((q, i) => `${i+1}. ${q.prompt}`).join("\n") : "Generate to see a preview…")} tags={["Exercise", "Learning"]} />
    </section>
  );
}

/* ----------------------------- Pack Generator (unchanged) ----------------------------- */
function PackGenerator() {
  const { publishAsNote } = usePublish();
  const { push } = useToast();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [focus, setFocus] = useState("General");
  const [sections, setSections] = useState<string[]>([]);

  function generate() {
    const base = range === "weekly" ? "This Week in Current Affairs" : "This Month in Current Affairs";
    const out = [
      `${base} — ${focus}`,
      "• Top Headlines: 3–5 bullets",
      "• Context & Why it matters",
      "• Vocabulary: 5 frequently-used words",
      "• Quick Quiz: 3 MCQs",
    ];
    setSections(out);
    push({ variant: "success", message: "Outline generated 🌍" });
  }

  const body = sections.join("\n");
  const tags = ["CurrentAffairs", "Learning"];

  async function publish() {
    await publishAsNote(`${body}\n\n#${tags[0]} #${tags[1]}`);
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="font-medium">Current Affairs Pack</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <select value={range} onChange={(e) => setRange(e.target.value as "weekly" | "monthly")} className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Focus (e.g., India, Science, Economy)" className="rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
          <button onClick={generate} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50" type="button">Generate outline (stub)</button>
        </div>

        <div className="rounded-xl border p-3">
          {sections.length === 0 ? (
            <div className="text-sm text-gray-500">No outline yet — click Generate.</div>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {sections.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={() => setSections([])} className="rounded-xl px-3 py-2 text-sm hover:bg-gray-50 border" type="button">Clear</button>
          <button onClick={publish} disabled={sections.length === 0} className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" type="button">Publish</button>
        </div>
      </div>

      <PreviewCard title={sections[0] || "Current Affairs Pack"} subtitle={sections.length ? undefined : "Choose range and focus, then Generate"} body={sections.slice(1).join("\n")} tags={tags} />
    </section>
  );
}

/* --------------------------------- Page --------------------------------- */
export default function CreatePage() {
  const [tab, setTab] = useState<TabKey>("story");

  const right = (
    <>
      <WhoToFollow />
      <TrendingBooks />
    </>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <Shell right={right}>
        {/* Header + Tabs */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Create</h2>
              <p className="text-sm text-gray-600">Write stories, generate exercises, and publish learning packs.</p>
            </div>
            <div className="sm:w-[420px]">
              <Tabs tab={tab} onChange={setTab} />
            </div>
          </div>
        </div>

        {tab === "story" && <StoryComposer />}
        {tab === "exercise" && <ExerciseGenerator />}
        {tab === "pack" && <PackGenerator />}

        {/* Tips */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-medium">Tips</h3>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>Add a one-line hook at the start of your story to improve engagement.</li>
            <li>Keep exercises short (5–10 items) for higher completion.</li>
            <li>Tag your posts (<code>#Kids</code>, <code>#Quiz</code>, <code>#CurrentAffairs</code>) to improve discovery.</li>
          </ul>
        </div>
      </Shell>
    </main>
  );
}

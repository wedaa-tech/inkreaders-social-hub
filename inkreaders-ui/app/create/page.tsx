"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/app/components/Shell";
import WhoToFollow from "@/app/components/right/WhoToFollow";
import { TrendingBooks } from "@/app/components/right/TrendingBooks";
import { useToast } from "@/app/components/ToastProvider";
import { normalizeExercise, Exercise as NormalizedExercise } from "@/lib/normalizeExercise";
import { FaBook, FaPencilAlt, FaGlobeAmericas, FaSpinner, FaMagic, FaRegLightbulb } from 'react-icons/fa'; // Added icon imports
import { CiCircleCheck, CiCircleAlert } from "react-icons/ci"; // Toast icons
import { IoIosWarning } from "react-icons/io";

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
  const base = "flex-1 flex items-center justify-center rounded-full px-4 py-2 text-sm transition-all duration-300 font-medium";
  const active = "bg-white text-[color:var(--color-brand)] shadow-lg";
  const inactive = "text-gray-600 hover:bg-gray-100";

  return (
    <div className="flex items-center space-x-2 rounded-full bg-gray-100 p-1.5 shadow-inner">
      <button onClick={() => onChange("story")} className={`${base} ${tab === "story" ? active : inactive}`} type="button">
        <FaPencilAlt className="mr-2" /> Story
      </button>
      <button onClick={() => onChange("exercise")} className={`${base} ${tab === "exercise" ? active : inactive}`} type="button">
        <FaBook className="mr-2" /> Exercise
      </button>
      <button onClick={() => onChange("pack")} className={`${base} ${tab === "pack" ? active : inactive}`} type="button">
        <FaGlobeAmericas className="mr-2" /> Pack
      </button>
    </div>
  );
}

/* ----------------------------- Preview Card ----------------------------- */
function PreviewCard({ title, subtitle, body, tags }: { title: string; subtitle?: string; body: string; tags?: string[] }) {
  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
      <header className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-500">
          <FaRegLightbulb />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">You</span>
            <span className="truncate text-sm text-gray-500">@reader.example</span>
          </div>
          <div className="mt-1">
            <div className="font-semibold text-lg text-gray-900">{title}</div>
            {subtitle && <div className="text-sm text-gray-600 mt-0.5">{subtitle}</div>}
          </div>
        </div>
      </header>

      <div className="mt-4">
        <pre className="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 font-sans">{body}</pre>
        {tags && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 font-medium transition hover:bg-gray-200">#{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500">
        <div className="flex items-center gap-6">
          <span className="cursor-pointer hover:text-[color:var(--color-brand)] transition">💬 0</span>
          <span className="cursor-pointer hover:text-green-500 transition">🔁 0</span>
          <span className="cursor-pointer hover:text-red-500 transition">❤️ 0</span>
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
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Generate an Exercise</h3>
        <form onSubmit={handleGenerate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input name="title" placeholder="Title (optional)" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent col-span-2" />
          <input name="topic" placeholder="Topic (e.g., Solar System)" required className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent col-span-2" />

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Format</label>
            <select name="format" defaultValue="mcq" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent">
              <option value="mcq">Multiple Choice</option>
              <option value="true_false">True/False</option>
              <option value="fill_blank">Fill in the Blank</option>
              <option value="match">Matching</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Count</label>
            <input name="count" type="number" defaultValue={5} min={1} max={20} className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Difficulty</label>
            <select name="difficulty" defaultValue="mixed" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">Language</label>
            <select name="language" defaultValue="en" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>

          <div className="col-span-full flex gap-3 mt-4 justify-end">
            <button type="button" onClick={() => { setExercise(null); push({ variant: "success", message: "Cleared" }); }} className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Clear</button>
            <button type="submit" disabled={loading} className="flex items-center rounded-xl bg-[color:var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed">
              {loading && <FaSpinner className="animate-spin mr-2" />}
              {loading ? "Generating…" : "Generate"}
            </button>
            <button type="button" onClick={handleSaveAndPreview} disabled={!exercise} className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Save & Continue
            </button>
          </div>
        </form>

        {/* Preview */}
        {exercise ? (
          <div className="mt-6 rounded-2xl bg-gray-100 p-5 border border-gray-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
              <div>
                <div className="font-semibold text-gray-800">{exercise.title || "(untitled)"}</div>
                <div className="text-sm text-gray-600">{exercise.format?.toUpperCase()} • {exercise.difficulty}</div>
              </div>
              <div className="text-sm text-gray-500">Language: {language}</div>
            </div>

            <ul className="space-y-4">
              {exercise.questions?.map((q, idx) => (
                <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="font-medium text-gray-800">Q{idx + 1}. {q.prompt}</p>
                  {q.options && q.options.length > 0 && (
                    <ul className="ml-4 list-disc space-y-1 mt-2 text-sm text-gray-600">
                      {q.options.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  )}
                  <div className="flex items-center text-sm text-green-700 mt-2 font-medium">
                    <CiCircleCheck className="mr-1 text-base text-green-600" /> Answer: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : typeof q.correctAnswer === "object" ? JSON.stringify(q.correctAnswer) : String(q.correctAnswer)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-gray-100 p-6 text-center text-gray-500">
            <IoIosWarning className="text-4xl text-gray-400 mx-auto mb-2" />
            <div className="text-sm">No preview yet — generate to see the exercise.</div>
          </div>
        )}
      </div>

      {/* Live preview card */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner">
        <h4 className="text-xl font-semibold mb-4 text-gray-800">Preview as Post</h4>
        <PreviewCard title={exercise ? (exercise.title || "Exercise Preview") : "Exercise Preview"} subtitle={exercise ? `${exercise.format?.toUpperCase()} • ${exercise.difficulty}` : "Provide topic and generate"} body={(exercise ? exercise.questions.slice(0, 6).map((q, i) => `${i+1}. ${q.prompt}`).join("\n") : "Generate to see a preview…")} tags={["Exercise", "Learning"]} />
      </div>
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
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Current Affairs Pack</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <select value={range} onChange={(e) => setRange(e.target.value as "weekly" | "monthly")} className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Focus (e.g., India, Science)" className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent" />
          <button onClick={generate} className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition" type="button">
            <FaMagic className="mr-2 inline-block" /> Generate outline
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-100 p-5 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-2">Generated Outline</h4>
          {sections.length === 0 ? (
            <div className="text-center text-gray-500">
              <IoIosWarning className="text-4xl text-gray-400 mx-auto mb-2" />
              <div className="text-sm">No outline yet — click Generate.</div>
            </div>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-gray-700">
              {sections.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setSections([])} className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition" type="button">Clear</button>
          <button onClick={publish} disabled={sections.length === 0} className="rounded-xl bg-[color:var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed" type="button">Publish</button>
        </div>
      </div>

      {/* Live preview card */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner">
        <h4 className="text-xl font-semibold mb-4 text-gray-800">Preview as Post</h4>
        <PreviewCard title={sections[0] || "Current Affairs Pack"} subtitle={sections.length ? undefined : "Choose range and focus, then Generate"} body={sections.slice(1).join("\n") || "Generate to see a preview…"} tags={tags} />
      </div>
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
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Shell right={right}>
        {/* Header + Tabs */}
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl border border-gray-200 shadow-xl mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Create & Share</h2>
              <p className="text-base text-gray-600 mt-1">Write stories, generate exercises, and publish learning packs with AI.</p>
            </div>
            <div className="sm:w-[480px]">
              <Tabs tab={tab} onChange={setTab} />
            </div>
          </div>
        </div>

        {tab === "story" && <StoryComposer />}
        {tab === "exercise" && <ExerciseGenerator />}
        {tab === "pack" && <PackGenerator />}

        {/* Tips */}
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-3xl border border-teal-200 shadow-lg mt-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl text-teal-600">💡</div>
            <div>
              <h3 className="text-lg font-bold text-teal-800">Pro Tips for Polished Posts</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>Add a one-line hook at the start of your story to capture attention.</li>
                <li>Keep exercises short (5–10 items) for higher completion rates.</li>
                <li>Use relevant tags (<code>#Kids</code>, <code>#Quiz</code>, <code>#CurrentAffairs</code>) to improve discovery.</li>
              </ul>
            </div>
          </div>
        </div>
      </Shell>
    </main>
  );
}
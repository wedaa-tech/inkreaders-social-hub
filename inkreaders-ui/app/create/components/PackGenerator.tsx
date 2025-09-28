// app/create/components/PackGenerator.tsx
import React, { useState } from "react";
import { FaMagic, FaSpinner, IoIosWarning } from "@/app/create/components/icons";
import PreviewCard from "@/app/create/components/PreviewCard";
import { usePublish } from "@/app/create/lib/publish";
import { useToast } from "@/app/components/util/ToastProvider";
import { API_BASE } from "@/app/create/lib/api";

// Define the type for a Section, making it explicit.
type Section = { id: string; title: string; body: string };

export default function PackGenerator() {
  const { publishAsNote } = usePublish();
  const { push } = useToast();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [focus, setFocus] = useState("General");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Helper function to create a new section object.
  function makeSection(title = "New Section", body = "") {
    return { id: Math.random().toString(36).slice(2, 9), title, body };
  }

  // Handle the main generation process with clear user feedback.
  async function generate() {
    if (generating) return;

    setGenerating(true);
    setSections([]); // Clear sections for a fresh start.
    push({ variant: "info", message: "Creating an outline..." });

    try {
      const outlineTitles = [
        `Top Headlines`,
        "Context",
        "Vocabulary",
        "Quick Quiz",
      ];
      setSections(outlineTitles.map((t) => makeSection(t)));
      push({ variant: "success", message: "Outline created. Now refining with AI..." });

      // Call the AI API to fill in the content.
      const res = await fetch(`${API_BASE}/api/packs/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ range, focus }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sections)) {
          setSections(data.sections.map((s: any) => ({
            id: Math.random().toString(36).slice(2, 9),
            title: s.title || "",
            body: s.body || "",
          })));
          push({ variant: "success", message: "AI has filled in the details! ✅" });
        }
      } else {
        throw new Error("API call failed.");
      }
    } catch (e) {
      console.warn("AI generator failed, keeping outline.", e);
      push({ variant: "warning", message: "AI generation failed. Please edit the sections manually." });
    } finally {
      setGenerating(false);
    }
  }

  // CRUD operations for sections.
  function addSection() {
    setSections((s) => [...s, makeSection()]);
  }
  function removeSection(id: string) {
    setSections((s) => s.filter((x) => x.id !== id));
  }
  function updateSection(id: string, patch: Partial<Pick<Section, "title" | "body">>) {
    setSections((s) => s.map((x) => x.id === id ? { ...x, ...patch } : x));
  }

  // Generate a quiz from a section's body text.
  async function buildQuizFromContext(id: string) {
    const sec = sections.find((x) => x.id === id);
    if (!sec) {
      return push({ variant: "error", title: "Error", message: "Section not found." });
    }
    if (!sec.body) {
      return push({ variant: "warning", title: "Cannot Generate", message: "Section is empty. Add content first." });
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/packs/quiz-from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: sec.body, count: 3 }),
      });

      if (!res.ok) {
        throw new Error("Quiz generation failed.");
      }

      const data = await res.json();
      const quizSection = makeSection(
        "Quick Quiz (auto-generated)",
        (data.quiz || []).map((q: any, i: number) => {
          const opts = (q.options || []).map((o: any, idx: number) => `${String.fromCharCode(97 + idx)}) ${o}`).join("\n");
          return `${i + 1}. ${q.prompt}\n${opts}\nAnswer: ${q.answer}`;
        }).join("\n\n")
      );

      setSections((s) => [...s, quizSection]);
      push({ variant: "success", message: "Quick quiz added." });
    } catch (e: any) {
      console.error("Quiz generation error:", e);
      push({ variant: "error", title: "Quiz Generation Failed", message: e?.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // Save the pack to the database.
  async function savePack() {
    if (sections.length === 0) {
      return push({ variant: "error", title: "Empty", message: "Generate or add at least one section." });
    }
    setLoading(true);
    try {
      const payload = { range, focus, sections };
      const res = await fetch(`${API_BASE}/api/packs/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Save operation failed.");
      }

      const data = await res.json();
      push({ variant: "success", message: "Pack saved successfully!" });
      if (data.id) {
        window.location.href = `/packs/${data.id}`;
      }
    } catch (e: any) {
      console.error("Save error:", e);
      push({ variant: "error", title: "Save Failed", message: e?.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // Publish the pack as a public note.
  async function publish() {
    if (sections.length === 0) {
      return push({ variant: "error", title: "Empty", message: "Generate content before publishing." });
    }
    const body = sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n");
    await publishAsNote(`${body}\n\n#CurrentAffairs #ExamPrep`);
  }

  const primaryTitle = sections.length > 0
    ? `${range === "weekly" ? "This Week" : "This Month"} in Current Affairs`
    : "Current Affairs Pack";

  const previewBody = sections.map(s => `## ${s.title}\n\n${s.body}`).join("\n\n") || "Generate content to see a live preview...";

  return (
    <section className="space-y-8">
      {/* Main Control Panel */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Current Affairs Pack Generator</h3>
        <p className="text-gray-600 mb-6">Create exam-ready current affairs notes with a few clicks. Just set your preferences and let the AI do the work.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as "weekly" | "monthly")}
            className="rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="weekly">Weekly Pack</option>
            <option value="monthly">Monthly Pack</option>
          </select>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Focus (e.g., India, Science & Tech)"
            className="rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent col-span-2"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-xl bg-blue-600 text-white px-6 py-3 font-semibold shadow-md hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center col-span-full xl:col-span-1"
          >
            {generating ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FaMagic className="mr-2" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area (Sections) */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
        <h4 className="text-xl font-semibold text-gray-800 mb-4">Pack Sections</h4>
        <p className="text-gray-600 mb-6">Review, edit, or add new sections as needed. Content is always editable.</p>
        
        {sections.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <IoIosWarning className="text-5xl text-gray-400 mx-auto mb-4" />
            <div className="text-base font-medium">No content yet.</div>
            <div className="text-sm">Click "Generate" above to get started or "Add Section" below.</div>
            <button
              onClick={addSection}
              className="mt-6 rounded-full bg-gray-50 border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              + Add Section Manually
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  {/* Title and Body inputs are always visible and editable */}
                  <input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, { title: e.target.value })}
                    placeholder="Section Title"
                    className="w-full text-lg font-semibold rounded-lg border border-gray-300 px-4 py-2 outline-none"
                  />
                  <textarea
                    value={s.body}
                    onChange={(e) => updateSection(s.id, { body: e.target.value })}
                    placeholder="Add your content here..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 h-36 text-gray-700 resize-y outline-none"
                  />
                </div>
                {/* Action buttons for each section */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                  <span className="text-sm text-gray-500 font-medium">Section {i + 1}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => buildQuizFromContext(s.id)}
                      disabled={loading || !s.body}
                      className="rounded-full bg-white border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      Auto-quiz
                    </button>
                    <button
                      onClick={() => removeSection(s.id)}
                      className="rounded-full bg-white border border-gray-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={addSection}
                className="rounded-full bg-gray-50 border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                + Add Section
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action and Preview Section */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner flex flex-col xl:flex-row gap-6">
        {/* Buttons for main actions */}
        <div className="flex-1 rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Actions</h4>
          <div className="flex flex-col gap-4">
            <button
              onClick={savePack}
              disabled={loading || sections.length === 0}
              className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-green-700 transition disabled:opacity-60"
            >
              Save Pack
            </button>
            <button
              onClick={publish}
              disabled={loading || sections.length === 0}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-60"
            >
              Publish to My Notes
            </button>
            <button
              onClick={() => setSections([])}
              className="w-full rounded-xl bg-white border border-gray-300 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Clear All Sections
            </button>
          </div>
        </div>
        
        {/* Live preview card */}
        <div className="flex-1 rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Live Preview</h4>
          <PreviewCard
            title={primaryTitle}
            subtitle={sections.length ? `${range} pack on ${focus}` : "Choose range and focus, then Generate"}
            body={previewBody}
            tags={["CurrentAffairs", "ExamPrep"]}
          />
        </div>
      </div>
    </section>
  );
}
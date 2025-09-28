// app/create/pack/PackBuilder.tsx
"use client";

import React, { useState } from "react";
import PromptBar from "./PromptBar";
import PackCanvas from "./PackCanvas";
import InspectorPanel from "./InspectorPanel";
import { Pack, Section } from "./types";
import { generateMockPack, mockQuizFromText } from "./mock";
import { useToast } from "@/app/components/util/ToastProvider";

export default function PackBuilder() {
  const { push } = useToast();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<Pack>({
    title: "",
    focus: "",
    range: "weekly",
    tags: [],
    visibility: "private",
    sections: [],
  });


  async function handleBuildPack() {
    if (!prompt.trim()) {
      push({ variant: "error", title: "Missing prompt", message: "Type a prompt to build a pack" });
      return;
    }
    setLoading(true);
    try {
      const result = await generateMockPack(prompt, pack.range, pack.focus || "General");
      setPack(result);
      push({ variant: "success", message: "Outline generated (mock)" });
    } catch (e: any) {
      console.error(e);
      push({ variant: "error", title: "Failed", message: e?.message || "Could not generate" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateExplanation() {
    if (!prompt.trim()) {
      push({ variant: "error", title: "Missing prompt", message: "Type a prompt to explain" });
      return;
    }
    setLoading(true);
    try {
      // For the wireframe we reuse generateMockPack but could call specific endpoint
      const result = await generateMockPack(prompt, pack.range, pack.focus || "General");
      // Only pick first explanation section and prepend to pack
      const explanation = result.sections.find((s) => s.kind === "explanation")!;
      setPack((prev) => ({ ...prev, sections: [explanation, ...prev.sections] }));
      push({ variant: "success", message: "Explanation added" });
    } catch (e: any) {
      console.error(e);
      push({ variant: "error", title: "Failed", message: e?.message || "Could not generate explanation" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateQuiz() {
    // create quick quiz from combined sections as a single text blob
    const blob = pack.sections.map((s) => s.title + "\n" + s.body).join("\n\n");
    setLoading(true);
    try {
      // mock quiz
      // @ts-ignore
      const data = await mockQuizFromText(blob, 3) as any;
      const quizBody = (data.quiz || []).map((q: any, idx: number) => {
        const opts = (q.options || []).map((o: any, i: number) => `${String.fromCharCode(97 + i)}) ${o}`).join("\n");
        return `${idx + 1}. ${q.prompt}\n${opts}\nAnswer: ${q.answer}`;
      }).join("\n\n");

      const newSection: Section = {
        id: "q" + Math.random().toString(36).slice(2, 9),
        title: "Quick Quiz (auto)",
        body: quizBody,
        kind: "quiz",
      };
      setPack((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
      push({ variant: "success", message: "Quiz added (mock)" });
    } catch (e: any) {
      console.error(e);
      push({ variant: "error", title: "Quiz failed", message: e?.message || "Could not create quiz" });
    } finally {
      setLoading(false);
    }
  }

  function onEditSection(id: string) {
    setPack((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, editable: true } : s)),
    }));
  }

  function onRemoveSection(id: string) {
    setPack((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
  }

  async function onAutoQuiz(id: string) {
    const sec = pack.sections.find((s) => s.id === id);
    if (!sec) return;
    setLoading(true);
    try {
      // @ts-ignore
      const data = await mockQuizFromText(sec.body, 3) as any;
      const quizBody = (data.quiz || []).map((q: any, idx: number) => {
        const opts = (q.options || []).map((o: any, i: number) => `${String.fromCharCode(97 + i)}) ${o}`).join("\n");
        return `${idx + 1}. ${q.prompt}\n${opts}\nAnswer: ${q.answer}`;
      }).join("\n\n");

      const newSection: Section = {
        id: "q" + Math.random().toString(36).slice(2, 9),
        title: `${sec.title} — Quick Quiz (auto)`,
        body: quizBody,
        kind: "quiz",
      };
      setPack((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
      push({ variant: "success", message: "Auto-quiz appended (mock)" });
    } catch (e: any) {
      console.error(e);
      push({ variant: "error", title: "Quiz failed", message: e?.message || "Could not create quiz" });
    } finally {
      setLoading(false);
    }
  }

  function onReorder(newSections: Section[]) {
    setPack((prev) => ({ ...prev, sections: newSections }));
  }

  async function onSave() {
    // mock save: just toast and mark as saved
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      push({ variant: "success", message: "Pack saved (mock)" });
    } finally {
      setLoading(false);
    }
  }

  async function onPublish() {
    // mock publish: toast and set visibility public
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setPackPartial({ visibility: "public" });
      push({ variant: "success", message: "Pack published (mock)" });
    } finally {
      setLoading(false);
    }
  }

  // helper to set partial pack fields from inspector
  function setPackPartial(p: Partial<Pack>) {
    setPack((prev) => ({ ...prev, ...p }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <PromptBar
          prompt={prompt}
          setPrompt={setPrompt}
          busy={loading}
          onBuildPack={handleBuildPack}
          onGenerateExplanation={handleGenerateExplanation}
          onCreateQuiz={handleCreateQuiz}
        />

        <PackCanvas
          sections={pack.sections}
          onEdit={onEditSection}
          onRemove={onRemoveSection}
          onAutoQuiz={onAutoQuiz}
          onReorder={onReorder}
        />
      </div>

      <div className="lg:col-span-1">
        <InspectorPanel
          pack={pack}
          setPack={(p) => setPackPartial(p)}
          onSave={onSave}
          onPublish={onPublish}
        />
      </div>
    </div>
  );
}

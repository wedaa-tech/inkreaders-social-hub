// app/create/components/ExerciseGenerator.tsx
"use client";

import React, { useState } from "react";
import { FaSpinner, FaPencilAlt, FaRegLightbulb } from "@/app/create/components/icons"; // Added FaPencilAlt, FaRegLightbulb
import PreviewCard from "@/app/create/components/PreviewCard";
import {
  normalizeExercise,
  Exercise as NormalizedExercise,
} from "@/lib/normalizeExercise";
import { useToast } from "@/app/components/util/ToastProvider";
import QuestionPreview from "./QuestionPreview";
import { apiFetchJson } from "@/lib/api";

// --- START: Prompt Assembly Utility (Kept and slightly enhanced) ---
function assemblePrompt(
  topic: string,
  format: string,
  count: number,
  difficulty: string,
  language: string,
  goal: string, // New parameter for Goal/Role
  specialInstructions: string // New parameter for Special Instructions
): string {
  // 1. Role/Context: Define the persona based on the user's goal
  let role = "";
  if (goal === "quiz") {
    role = "You are an expert tutor creating a practice quiz for a student.";
  } else if (goal === "exam") {
    role = "You are a demanding test-prep specialist generating an exam-style test.";
  } else if (goal === "flashcards") {
    role = "You are a vocabulary specialist creating simple, direct flashcards.";
  } else {
    role = "You are an expert educational content generator and test-prep specialist.";
  }

  // 2. Instruction: The specific command.
  const instruction = `Your task is to generate an exercise set.`;

  // 3. Constraints/Format: Detailed rules and structure.
  let formatInstruction = "";
  if (format === "mcq") {
    formatInstruction = `The questions must be **Multiple Choice Questions (MCQ)**, each with exactly 4 options.`;
  } else if (format === "true_false") {
    formatInstruction = `The questions must be **True/False** statements.`;
  } else if (format === "fill_blank") {
    formatInstruction = `The questions must be **Fill in the Blank** statements, where the correct answer is the word or short phrase that completes the blank.`;
  } else if (format === "match") {
    formatInstruction = `The questions must be a **Matching** exercise, providing two corresponding lists (List A and List B) that need to be paired.`;
  }
  
  const instructionsBlock = specialInstructions 
    ? `\n\n**SPECIAL INSTRUCTIONS**: ${specialInstructions}`
    : '';

  // 4. Assembled Prompt: Combine all parts.
  return `
${role} ${instruction}
The exercise must contain exactly **${count} questions**.
The subject of the exercise is: **${topic}**.
The required difficulty level is **${difficulty}**.
The response must be in the **${
      language === "en" ? "English" : "Hindi"
    }** language.

${formatInstruction}
${instructionsBlock}

You must return the entire exercise set in the required JSON format as defined by the API schema, with the 'exercise_set' field containing the questions, answers, and explanations. Do not include any other text or commentary outside of the JSON.
`.trim();
}
// --- END: Prompt Assembly Utility ---

export default function ExerciseGenerator() {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<NormalizedExercise | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    
    // Extract all values from form
    const title = form.get("title")?.toString() || "";
    const topic = form.get("topic")?.toString() || "";
    const format = form.get("format")?.toString() || "mcq";
    const count = Number(form.get("count") || 5);
    const difficulty = form.get("difficulty")?.toString() || "mixed";
    const language = (form.get("language")?.toString() as "en" | "hi") || "en";
    // ✅ NEW: Extract new fields
    const goal = form.get("goal")?.toString() || "quiz";
    const specialInstructions = form.get("special_instructions")?.toString() || "";

    // ✅ NEW: Pass all fields to the enhanced assemblePrompt
    const llm_prompt = assemblePrompt(topic, format, count, difficulty, language, goal, specialInstructions);

    const body = {
      title,
      topic,
      formats: [format],
      count,
      difficulty,
      language,
      source: { type: "topic" },
      llm_prompt, // The complete, assembled prompt for the LLM
    };

    setLoading(true);
    try {
      console.log("📡 Generating exercise with prompt:", llm_prompt);
      // Your API call to the server
      const data = await apiFetchJson<{ exercise_set: any }>("/api/exercises/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const normalized = normalizeExercise(data.exercise_set);
      setExercise(normalized);
      setLanguage(body.language);
      push({ variant: "success", message: "Generated exercise preview" });
    } catch (err: any) {
      console.error("🔥 Generate failed:", err);
      push({
        variant: "error",
        title: "Generate failed",
        message: err.message || "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndPreview() {
    if (!exercise) return;
    try {
      console.log("💾 Saving exercise:", exercise);
      const data = await apiFetchJson<{ id: string }>("/api/exercises/save", {
        method: "POST",
        body: JSON.stringify({ exercise_set: exercise, visibility: "private" }),
      });

      if (data.id) {
        window.location.href = `/exercises/${data.id}/preview`;
      }
    } catch (err: any) {
      console.error("🔥 Save failed:", err);
      push({
        variant: "error",
        title: "Save failed",
        message: err.message || "Could not save exercise",
      });
    }
  }


  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaPencilAlt className="mr-2 text-gray-500" /> Design Your Exercise Prompt
        </h3>
        <form
          onSubmit={handleGenerate}
          className="grid gap-6"
        >
          {/* 1. TOPIC INPUT (The Subject) */}
          <fieldset className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
            <legend className="px-2 text-md font-semibold text-gray-700">1. Topic & Title</legend>
            <input
                name="title"
                placeholder="Exercise Title (e.g., WWII Key Battles)"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent mb-3"
            />
            <textarea
                name="topic"
                placeholder="Enter the specific topic you want to be tested on (e.g., Molecular Biology, The causes of World War I, Calculus Chain Rule)."
                required
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent resize-none"
            />
          </fieldset>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* 2. OUTPUT INSTRUCTION & ROLE (The Action & Persona) */}
            <fieldset className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
              <legend className="px-2 text-md font-semibold text-gray-700">2. Goal & Question Type</legend>
              
              {/* Goal/Role */}
              <div className="mb-4">
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Goal/Role</label>
                  <select
                      name="goal"
                      defaultValue="quiz"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
                  >
                      <option value="quiz">Generate a Practice Quiz (Expert Tutor)</option>
                      <option value="exam">Generate an Exam-Style Test (Test-Prep Specialist)</option>
                      <option value="flashcards">Generate Flashcards (Vocabulary Specialist)</option>
                  </select>
              </div>

              {/* Question Type */}
              <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Question Type</label>
                  <select
                      name="format"
                      defaultValue="mcq"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
                  >
                      <option value="mcq">Multiple Choice</option>
                      <option value="true_false">True/False</option>
                      <option value="fill_blank">Fill in the Blank</option>
                      <option value="match">Matching</option>
                  </select>
              </div>
            </fieldset>

            {/* 3. CONSTRAINTS (The Rules) */}
            <fieldset className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
              <legend className="px-2 text-md font-semibold text-gray-700">3. Constraints & Rules</legend>
              <div className="grid grid-cols-2 gap-4">
                  {/* Count */}
                  <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-600 mb-1">Quantity</label>
                      <input
                          name="count"
                          type="number"
                          defaultValue={5}
                          min={1}
                          max={20}
                          className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
                      />
                  </div>
                  {/* Difficulty */}
                  <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-600 mb-1">Difficulty</label>
                      <select
                          name="difficulty"
                          defaultValue="mixed"
                          className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
                      >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                          <option value="mixed">Mixed</option>
                      </select>
                  </div>
                  {/* Language */}
                  <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-600 mb-1">Language</label>
                      <select
                          name="language"
                          defaultValue="en"
                          className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent"
                      >
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                      </select>
                  </div>
                  {/* Target Audience - Placeholder/Expansion Spot for future */}
                  <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-600 mb-1">Audience</label>
                      <select
                          disabled // Placeholder for future feature
                          name="audience"
                          defaultValue="general"
                          className="rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent bg-gray-100 cursor-not-allowed"
                      >
                          <option value="general">General Knowledge</option>
                          <option value="highschool">High School</option>
                      </select>
                  </div>
              </div>
            </fieldset>
          </div>

          {/* 4. OPTIONAL: Special Instructions (The Fine Tuning) */}
          <fieldset className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
            <legend className="px-2 text-md font-semibold text-gray-700 flex items-center">
                <FaRegLightbulb className="mr-2 text-amber-500"/> Optional Fine-Tuning
            </legend>
            <textarea
                name="special_instructions"
                placeholder="e.g., 'Focus only on vocabulary and definitions', 'Must include one word problem', 'Avoid subjective questions'."
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-[color:var(--color-brand)] focus:border-transparent resize-none"
            />
          </fieldset>

          {/* Action Buttons */}
          <div className="col-span-full flex gap-3 mt-4 justify-end">
            <button
              type="button"
              onClick={() => {
                setExercise(null);
                push({ variant: "success", message: "Cleared" });
              }}
              className="rounded-xl bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center rounded-xl bg-[color:var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <FaSpinner className="animate-spin mr-2" />}
              {loading ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndPreview}
              disabled={!exercise}
              className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Continue
            </button>
          </div>
        </form>

        {/* Preview Section (Remains the same) */}
        {/* ... (Your existing preview code) ... */}
        {exercise ? (
          <div className="mt-6 rounded-2xl bg-gray-100 p-5 border border-gray-200">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
              <div>
                <div className="font-semibold text-gray-800">
                  {exercise.title || "(untitled)"}
                </div>
                <div className="text-sm text-gray-600">
                  {exercise.format?.toUpperCase()} • {exercise.difficulty}
                </div>
              </div>
              <div className="text-sm text-gray-500">Language: {language}</div>
            </div>

            <ul className="space-y-4 mt-3">
              {exercise.questions?.map((q, idx) => (
                <QuestionPreview key={q.id} q={q} index={idx} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-gray-100 p-6 text-center text-gray-500">
            <span className="text-4xl text-gray-400 block mb-2">⚠️</span>
            <div className="text-sm">
              No preview yet — generate to see the exercise.
            </div>
          </div>
        )}
      </div>

      {/* Live preview card (Remains the same) */}
      <div className="bg-gray-100 p-6 rounded-3xl shadow-inner">
        <h4 className="text-xl font-semibold mb-4 text-gray-800">
          Preview as Post
        </h4>
        <PreviewCard
          title={
            exercise ? exercise.title || "Exercise Preview" : "Exercise Preview"
          }
          subtitle={
            exercise
              ? `${exercise.format?.toUpperCase()} • ${exercise.difficulty}`
              : "Provide topic and generate"
          }
          body={
            exercise
              ? exercise.questions
                  .slice(0, 6)
                  .map((q, i) => `${i + 1}. ${q.prompt}`)
                  .join("\n")
              : "Generate to see a preview…"
          }
          tags={["Exercise", "Learning"]}
        />
      </div>
    </section>
  );
}
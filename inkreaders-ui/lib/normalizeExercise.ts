// lib/normalizeExercise.ts

export type Exercise = {
  id: string;
  title: string;
  format: "mcq" | "fill_blank" | "true_false" | "mixed";
  difficulty: "easy" | "medium" | "hard" | "mixed";
  questions: Question[];
  createdAt: string;
  author?: string;
};

export type Question = {
  id: string;
  type: "mcq" | "fill_blank" | "true_false" | "mixed";
  prompt: string;
  options?: string[];
  correctAnswer: string | string[] | Record<string, string>;
  explanation?: string;
};

export type UserAnswer = {
  value: string | string[] | Record<string, string>;
  isCorrect: boolean;
  checked: boolean;
};

export type PracticeState = {
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  completed: boolean;
  score: number;
};

// Canonical to match your DB constraint
const formatMap = {
  mcq: "mcq",
  fill_blank: "fill_blank",
  fillblank: "fill_blank",
  true_false: "true_false",
  truefalse: "true_false",
  mixed: "mixed",
  match: "mixed",     // map to mixed unless you extend DB check to include 'match'
  matching: "mixed",
} as const;

type CanonicalFormat = keyof typeof formatMap;

function normalizeFormat(f: unknown): Exercise["format"] {
  const key = typeof f === "string" ? (f.toLowerCase() as CanonicalFormat) : "mcq";
  return (formatMap[key] as Exercise["format"]) ?? "mcq";
}

export function normalizeExercise(set: any): Exercise {
  const normalizedFormat = normalizeFormat(set?.format);

  return {
    id: set?.id ?? "",
    title: set?.title || "Untitled Exercise",
    format: normalizedFormat,
    difficulty: set?.meta?.difficulty || "mixed",
    createdAt: set?.created_at ?? new Date().toISOString(),
    author: set?.user_id,
    questions: Array.isArray(set?.questions)
      ? set.questions.map((q: any, idx: number) => {
          const qType = normalizeFormat(q?.type ?? normalizedFormat);

          const prompt =
            q?.prompt ??
            q?.q ??
            q?.question ??
            q?.text ??
            q?.statement ??
            "";

          // prefer correct_answer; then answer; treat null/undefined as empty
          let rawAnswer =
            q?.correct_answer != null
              ? q.correct_answer
              : q?.answer != null
              ? q.answer
              : "";

          if (qType === "true_false") {
            if (typeof rawAnswer === "boolean") {
              rawAnswer = rawAnswer ? "true" : "false";
            } else if (typeof rawAnswer !== "string") {
              rawAnswer = String(rawAnswer);
            }
          } else {
            if (rawAnswer == null) rawAnswer = "";
          }

          return {
            id: q?.id || `q${idx + 1}`,
            type: qType,
            prompt,
            options: q?.options || q?.choices || [],
            correctAnswer: rawAnswer,
            explanation: q?.explanation || q?.explain || "",
          };
        })
      : [],
  };
}

/**
 * Convert normalized (camelCase) Exercise to backend API/DB shape (snake_case).
 * Use this before POST /api/exercises/save.
 */
export function toApiExercise(
  ex: Exercise,
  opts?: { language?: string; sourceType?: string; seedSetId?: string | null }
) {
  return {
    id: ex.id,
    user_id: ex.author, // server will overwrite with session; harmless if empty
    title: ex.title,
    format: ex.format, // already canonical (mcq|fill_blank|true_false|mixed)
    questions: ex.questions.map((q, i) => ({
      id: q.id || `q${i + 1}`,
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? [],
      correct_answer: q.correctAnswer, // <-- CRITICAL: snake_case
      explanation: q.explanation ?? "",
      order_index: i,
    })),
    meta: {
      difficulty: ex.difficulty,
      language: opts?.language ?? "en",
      source: { type: opts?.sourceType ?? "topic" },
      seed_set_id: opts?.seedSetId ?? undefined,
    },
    visibility: "private",
  };
}

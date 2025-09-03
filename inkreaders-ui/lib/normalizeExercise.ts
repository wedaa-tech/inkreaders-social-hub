// lib/normalizeExercise.ts

export type Exercise = {
  id: string;
  title: string;
  format: "mcq" | "true_false" | "fill_blank" | "match";
  difficulty: "easy" | "medium" | "hard" | "mixed";
  questions: Question[];
  createdAt: string;
  author?: string;
};

export type Question = {
  id: string;
  type: "mcq" | "true_false" | "fill_blank" | "match";
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

// Map frontend-friendly → DB canonical
const formatMap: Record<string, "mcq" | "true_false" | "fill_blank" | "match"> =
  {
    mcq: "mcq",
    truefalse: "true_false",
    true_false: "true_false",
    fillblank: "fill_blank",
    fill_blank: "fill_blank",
    match: "match",
  };

export function normalizeExercise(set: any): Exercise {
  const normalizedFormat =
    formatMap[set.format?.toLowerCase?.()] || "mcq";

  return {
    id: set.id,
    title: set.title || "Untitled Exercise",
    format: normalizedFormat,
    difficulty: set.meta?.difficulty || "mixed",
    createdAt: set.created_at,
    author: set.user_id,
    questions: (set.questions || []).map((q: any, idx: number) => {
      const qType = formatMap[q.type?.toLowerCase?.()] || normalizedFormat;

      return {
        id: q.id || `q${idx + 1}`,
        type: qType,
        prompt: q.prompt || q.q || "",
        options: q.options || q.choices || [],
        // ✅ handle both backends
        correctAnswer:
          q.correct_answer !== undefined
            ? q.correct_answer
            : q.answer !== undefined
            ? q.answer
            : "",
        explanation: q.explanation || "",
      };
    }),
  };
}


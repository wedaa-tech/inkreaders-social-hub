"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ExerciseQuestion from "@/components/ExerciseQuestion";
import ProgressBar from "@/components/ProgressBar";
import QuestionNavigator from "@/components/QuestionNavigator";
import ExerciseResults from "@/components/ExerciseResults";

export type Exercise = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  questions: Question[];
  createdAt: string;
  author?: string;
};

export type Question = {
  id: string;
  type: "mcq" | "truefalse" | "fillblank" | "match";
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function ExercisePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params?.id as string;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [practice, setPractice] = useState<PracticeState>({
    currentIndex: 0,
    answers: {},
    completed: false,
    score: 0,
  });

  useEffect(() => {
    async function fetchExercise() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/exercises/${exerciseId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load exercise");

        const data = await res.json();
        const set = data.exercise_set;

        const ex: Exercise = {
          id: set.id,
          title: set.title,
          difficulty: set.meta?.difficulty || "mixed",
          createdAt: set.created_at,
          author: set.user_id,
          questions: (set.questions || []).map((q: any, idx: number) => ({
            id: q.id || `q${idx + 1}`,
            type: q.type,
            prompt: q.prompt || q.q,
            options: q.options,
            correctAnswer: q.correct_answer || q.answer,
            explanation: q.explanation,
          })),
        };

        setExercise(ex);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (exerciseId) fetchExercise();
  }, [exerciseId]);

  if (loading) return <div className="p-6">Loading exercise...</div>;
  if (!exercise) return <div className="p-6">Exercise not found.</div>;

  const currentQuestion = exercise.questions[practice.currentIndex];

  const checkAnswer = (qid: string, value: any) => {
    const q = exercise.questions.find((qq) => qq.id === qid);
    if (!q) return;

    let isCorrect = false;

    if (typeof q.correctAnswer === "string") {
      isCorrect =
        String(value).trim().toLowerCase() ===
        q.correctAnswer.trim().toLowerCase();
    } else if (Array.isArray(q.correctAnswer)) {
      isCorrect =
        JSON.stringify(value) === JSON.stringify(q.correctAnswer);
    } else if (typeof q.correctAnswer === "object") {
      isCorrect =
        JSON.stringify(value) === JSON.stringify(q.correctAnswer);
    }

    setPractice((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [qid]: { value, isCorrect, checked: true },
      },
    }));
  };

  const finishExercise = () => {
    const correctCount = Object.values(practice.answers).filter(
      (a) => a.isCorrect
    ).length;
    setPractice((prev) => ({
      ...prev,
      completed: true,
      score: correctCount,
    }));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{exercise.title}</h1>
      <p className="text-sm text-gray-600 mb-4">
        Difficulty: {exercise.difficulty}
      </p>

      <ProgressBar
        completed={practice.currentIndex + 1}
        total={exercise.questions.length}
      />

      {!practice.completed ? (
        <>
          <ExerciseQuestion
            question={currentQuestion}
            userAnswer={practice.answers[currentQuestion.id]}
            onAnswer={checkAnswer}
            onNext={() => {
              if (practice.currentIndex < exercise.questions.length - 1) {
                setPractice((prev) => ({
                  ...prev,
                  currentIndex: prev.currentIndex + 1,
                }));
              } else {
                finishExercise();
              }
            }}
          />

          <QuestionNavigator
            total={exercise.questions.length}
            currentIndex={practice.currentIndex}
            onNavigate={(i) =>
              setPractice((prev) => ({ ...prev, currentIndex: i }))
            }
            onFinish={finishExercise}
          />
        </>
      ) : (
        <div>
          <ExerciseResults
            exercise={exercise}
            answers={practice.answers}
            score={practice.score}
            onRetry={() =>
              setPractice({
                currentIndex: 0,
                answers: {},
                completed: false,
                score: 0,
              })
            }
          />
          <div className="mt-6">
            <button
              onClick={() => router.push("/exercises/mine")}
              className="px-4 py-2 bg-gray-600 text-white rounded"
            >
              ← Back to My Exercises
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

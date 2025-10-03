// app/exercises/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ExerciseQuestion from "@/app/components/exercise/ExerciseQuestion";
import ProgressBar from "@/app/components/util/ProgressBar";
import QuestionNavigator from "@/app/components/exercise/QuestionNavigator";
import ExerciseResults from "@/app/components/exercise/ExerciseResults";
import { apiFetchJson } from "@/lib/api";

import {
  normalizeExercise,
  Exercise,
  UserAnswer,
  PracticeState,
} from "@/lib/normalizeExercise";

export default function ExercisePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params?.id as string;

  console.log("🔎 useParams():", params);
  console.log("🔎 exerciseId:", exerciseId);

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
      console.log("📡 Fetching:", `/api/exercises/${exerciseId}`);
      try {
        setLoading(true);

        const data = await apiFetchJson<{ exercise_set: any }>(
          `/api/exercises/${exerciseId}`
        );

        console.log("📦 Raw API response:", data);

        const set = data.exercise_set;
        console.log("📝 Raw questions:", set?.questions);

        const normalized = normalizeExercise(set);
        console.log("✅ Normalized exercise:", normalized);

        setExercise(normalized);
      } catch (err: any) {
        console.error("🔥 fetchExercise error:", err.message || err);
      } finally {
        setLoading(false);
      }
    }

    if (exerciseId) {
      fetchExercise();
    } else {
      console.warn("⚠️ No exerciseId, skipping fetch.");
    }
  }, [exerciseId]);

  if (loading) return <div className="p-6">Loading exercise...</div>;
  if (!exercise) return <div className="p-6">Exercise not found.</div>;

  const currentQuestion = exercise.questions[practice.currentIndex];
  console.log("➡️ Current question:", currentQuestion);

  const checkAnswer = (qid: string, value: any) => {
    const q = exercise.questions.find((qq) => qq.id === qid);
    if (!q) return;

    let isCorrect = false;

    if (typeof q.correctAnswer === "string") {
      isCorrect =
        String(value).trim().toLowerCase() ===
        q.correctAnswer.trim().toLowerCase();
    } else if (Array.isArray(q.correctAnswer)) {
      isCorrect = JSON.stringify(value) === JSON.stringify(q.correctAnswer);
    } else if (typeof q.correctAnswer === "object") {
      isCorrect = JSON.stringify(value) === JSON.stringify(q.correctAnswer);
    }

    console.log("📝 checkAnswer:", { qid, value, correct: q.correctAnswer, isCorrect });

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

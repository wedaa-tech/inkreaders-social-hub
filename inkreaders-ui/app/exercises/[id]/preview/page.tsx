"use client";

import { useState, useEffect } from "react";
import ExerciseQuestion from "@/components/ExerciseQuestion";
import ProgressBar from "@/components/ProgressBar";
import QuestionNavigator from "@/components/QuestionNavigator";
import ExerciseResults from "@/components/ExerciseResults";

export type Exercise = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
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

export default function ExercisePreviewPage() {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [practice, setPractice] = useState<PracticeState>({
    currentIndex: 0,
    answers: {},
    completed: false,
    score: 0,
  });

  useEffect(() => {
    const sampleExercise: Exercise = {
      id: "ex-1",
      title: "JavaScript Basics",
      difficulty: "easy",
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: "q1",
          type: "mcq",
          prompt: "Which of these is NOT a JavaScript data type?",
          options: ["String", "Boolean", "Float", "Undefined"],
          correctAnswer: "Float",
          explanation: "JavaScript uses Number, not Float.",
        },
        {
          id: "q2",
          type: "mcq",
          prompt: "Which keyword declares a constant in JavaScript?",
          options: ["let", "var", "const", "define"],
          correctAnswer: "const",
          explanation:
            "`const` creates block-scoped constants that cannot be reassigned.",
        },
        {
          id: "q3",
          type: "truefalse",
          prompt: "JavaScript and Java are the same language.",
          correctAnswer: "False",
          explanation:
            "Despite the names, JavaScript and Java are completely different.",
        },
        {
          id: "q4",
          type: "fillblank",
          prompt:
            "The keyword used to declare a constant in JavaScript is _____.",
          correctAnswer: "const",
          explanation:
            "`const` declares block-scoped constants that cannot be reassigned.",
        },
        {
          id: "q5",
          type: "match",
          prompt:
            "Arrange the JS keywords in the correct order of scoping rules:",
          options: ["var", "let", "const"],
          correctAnswer: ["var", "let", "const"], // ✅ must be array
          explanation:
            "`var` < `let` < `const` in terms of safety & scoping strictness.",
        },
      ],
    };
    setExercise(sampleExercise);
  }, []);

  if (!exercise) return <div>Loading...</div>;

  const currentQuestion = exercise.questions[practice.currentIndex];

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

      <ProgressBar
        completed={Object.keys(practice.answers).length}
        total={exercise.questions.length}
      />

      {!practice.completed ? (
        <>
          <ExerciseQuestion
            question={currentQuestion}
            userAnswer={practice.answers[currentQuestion.id]}
            onAnswer={(qid, ans) =>
              setPractice((prev) => ({
                ...prev,
                answers: { ...prev.answers, [qid]: ans },
              }))
            }
            onNext={() => {
              // Only auto-advance if not on last question
              if (practice.currentIndex < exercise.questions.length - 1) {
                setPractice((prev) => ({
                  ...prev,
                  currentIndex: prev.currentIndex + 1,
                }));
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
          onRemix={() => {
            alert("TODO: Remix harder 💪");
          }}
        />
      )}
    </div>
  );
}

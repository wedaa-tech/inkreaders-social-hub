"use client";

import { useState, useEffect } from "react";
import { Question, UserAnswer } from "@/app/exercises/[id]/preview/page";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  question: Question;
  userAnswer?: UserAnswer;
  onAnswer: (qid: string, ans: UserAnswer) => void;
  onNext?: () => void;
};

// Small draggable block
function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded bg-gray-100 shadow cursor-grab"
    >
      {id}
    </div>
  );
}

export default function ExerciseQuestion({
  question,
  userAnswer,
  onAnswer,
  onNext,
}: Props) {
  const [selected, setSelected] = useState<string | null>(
    (userAnswer?.value as string) || null
  );

  const [ordering, setOrdering] = useState<string[]>([]);

  // ✅ Ensure ordering initializes correctly when question loads
  useEffect(() => {
    if (question.type === "match" && question.options) {
      setOrdering(question.options);
    }
  }, [question]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleSubmit = () => {
    let isCorrect = false;
    let answerValue: any = selected;

    if (question.type === "fillblank" && typeof question.correctAnswer === "string") {
      isCorrect =
        (selected ?? "").trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase();
    } else if (question.type === "mcq" || question.type === "truefalse") {
      isCorrect = selected === question.correctAnswer;
    } else if (question.type === "match") {
      answerValue = ordering;
      const expected = question.correctAnswer as string[];
      isCorrect = JSON.stringify(ordering) === JSON.stringify(expected);
    }

    onAnswer(question.id, {
      value: answerValue,
      isCorrect,
      checked: true,
    });

    if (onNext) {
      setTimeout(() => {
        onNext();
      }, 800);
    }
  };

  return (
    <div className="my-6">
      <h2 className="font-semibold mb-3">{question.prompt}</h2>

      {/* MCQ */}
      {question.type === "mcq" && (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${
                selected === opt ? "bg-blue-100 border-blue-400" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={selected === opt}
                onChange={() => setSelected(opt)}
                className="cursor-pointer"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {/* True/False */}
      {question.type === "truefalse" && (
        <div className="flex gap-4">
          {["True", "False"].map((opt) => (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className={`px-4 py-2 rounded border ${
                selected === opt
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white border-gray-300"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Fill-in-the-blank */}
      {question.type === "fillblank" && (
        <input
          type="text"
          placeholder="Type your answer..."
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
      )}

      {/* Matching/Ordering */}
      {question.type === "match" && ordering.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              setOrdering((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
              });
            }
          }}
        >
          <SortableContext items={ordering} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ordering.map((id) => (
                <SortableItem key={id} id={id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={handleSubmit}
        disabled={
          question.type === "match"
            ? ordering.length === 0
            : !selected
        }
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Submit
      </button>

      {userAnswer?.checked && (
        <div className="mt-3">
          {userAnswer.isCorrect ? (
            <p className="text-green-600 font-medium">✅ Correct!</p>
          ) : (
            <p className="text-red-600 font-medium">❌ Incorrect</p>
          )}
          {question.explanation && (
            <p className="text-sm text-gray-600 mt-1">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
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
  onAnswer: (qid: string, value: any) => void;
  onNext?: () => void;
};

// ✅ Small draggable block
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
      className="p-2 border rounded bg-white shadow cursor-grab"
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
  const [ordering, setOrdering] = useState<string[]>(
    question.type === "match" ? question.options || [] : []
  );
  const sensors = useSensors(useSensor(PointerSensor));

  // === Handlers ===
  const handleSelect = (val: string) => {
    onAnswer(question.id, val);
    if (onNext) setTimeout(onNext, 500); // short delay for feedback
  };

  const handleFillBlank = (val: string) => {
    onAnswer(question.id, val);
  };

  const handleFillBlankEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onNext) {
      onNext();
    }
  };

  const handleMatchNext = () => {
    onAnswer(question.id, ordering);
    if (onNext) onNext();
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
                userAnswer?.value === opt
                  ? "bg-blue-100 border-blue-400"
                  : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={userAnswer?.value === opt}
                onChange={() => handleSelect(opt)}
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
              onClick={() => handleSelect(opt)}
              className={`px-4 py-2 rounded border ${
                userAnswer?.value === opt
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
          placeholder="Type your answer... (press Enter to continue)"
          value={(userAnswer?.value as string) ?? ""}
          onChange={(e) => handleFillBlank(e.target.value)}
          onKeyDown={handleFillBlankEnter}
          className="border rounded px-3 py-2 w-full"
        />
      )}

      {/* Matching/Ordering */}
      {question.type === "match" && ordering.length > 0 && (
        <div>
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
          <button
            onClick={handleMatchNext}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Next →
          </button>
        </div>
      )}

      {/* Feedback */}
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

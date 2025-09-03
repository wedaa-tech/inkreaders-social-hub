import { Exercise, UserAnswer, Question } from "@/app/exercises/[id]/preview/page";

type Props = {
  exercise: Exercise;
  answers: Record<string, UserAnswer>;
  score: number;
  onRetry: () => void;
  onRemix: () => void;
};

export default function ExerciseResults({ exercise, answers, score, onRetry, onRemix }: Props) {
  const renderAnswer = (q: Question, ans?: UserAnswer) => {
    if (!ans) return <p className="text-gray-500">No answer provided</p>;

    if (q.type === "match") {
      return (
        <div className="mt-2">
          <p className={ans.isCorrect ? "text-green-600" : "text-red-600"}>
            Your order: {Array.isArray(ans.value) ? ans.value.join(" → ") : String(ans.value)}
          </p>
          {!ans.isCorrect && Array.isArray(q.correctAnswer) && (
            <p className="text-green-600">
              Correct order: {q.correctAnswer.join(" → ")}
            </p>
          )}
        </div>
      );
    }

    // For other types: show simple value
    return (
      <p className={ans.isCorrect ? "text-green-600" : "text-red-600"}>
        Your answer: {String(ans.value)}
        {!ans.isCorrect && (
          <span className="ml-2 text-green-600">
            (Correct: {String(q.correctAnswer)})
          </span>
        )}
      </p>
    );
  };

  return (
    <div className="my-6">
      <h2 className="text-xl font-bold mb-4">
        Results: {score} / {exercise.questions.length}
      </h2>

      {exercise.questions.map((q) => {
        const ans = answers[q.id];
        return (
          <div key={q.id} className="mb-4 border p-3 rounded">
            <p className="font-medium">{q.prompt}</p>
            {renderAnswer(q, ans)}
            {q.explanation && (
              <p className="text-sm text-gray-600 mt-1">{q.explanation}</p>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
        <button
          onClick={onRemix}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Remix Harder
        </button>
      </div>
    </div>
  );
}

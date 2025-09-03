type Props = {
  total: number;
  currentIndex: number;
  onNavigate: (i: number) => void;
  onFinish: () => void;
};

export default function QuestionNavigator({ total, currentIndex, onNavigate, onFinish }: Props) {
  return (
    <div className="flex justify-between mt-6">
      <button
        className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        disabled={currentIndex === 0}
        onClick={() => onNavigate(currentIndex - 1)}
      >
        Previous
      </button>

      {currentIndex < total - 1 ? (
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => onNavigate(currentIndex + 1)}
        >
          Next
        </button>
      ) : (
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={onFinish}
        >
          Finish
        </button>
      )}
    </div>
  );
}

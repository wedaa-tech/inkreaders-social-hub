type Props = {
  completed: number;
  total: number;
};

export default function ProgressBar({ completed, total }: Props) {
  const percent = (completed / total) * 100;

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 my-4">
      <div
        className="bg-blue-500 h-3 rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

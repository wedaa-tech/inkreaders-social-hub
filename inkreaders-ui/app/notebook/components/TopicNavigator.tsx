// app/notebook/TopicNavigator.tsx
"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());


export default function TopicNavigator({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error, isLoading, mutate } = useSWR("/api/topics?limit=20", fetcher, {
    refreshInterval: 30000, // keep fresh
  });

  if (error) return <div className="p-4 text-red-500">Failed to load topics</div>;
  if (isLoading) return <div className="p-4 text-gray-500">Loading...</div>;

  const topics = data?.items ?? [];

  return (
    <div className="p-2 space-y-2">
      {topics.map((t: any) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className="block w-full text-left bg-white rounded-lg shadow-sm p-2 hover:bg-gray-50"
        >
          <div className="font-medium truncate">{t.title}</div>
          <div className="text-xs text-gray-500">
            {new Date(t.updatedAt).toLocaleDateString()}
          </div>
        </button>
      ))}
      {topics.length === 0 && <div className="text-sm text-gray-400">No topics yet</div>}
    </div>
  );
}

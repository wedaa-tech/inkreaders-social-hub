// app/notebook/components/TopicCanvas.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import ResponseCard from "./ResponseCard";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export default function TopicCanvas({ topicId }: { topicId: string }) {
  const { data, error, isLoading, mutate: mutateTopic } = useSWR(
    topicId ? `/api/topics/${topicId}` : null,
    fetcher
  );
  const [responses, setResponses] = useState<any[]>([]);

  useEffect(() => {
    if (data?.responses) {
      setResponses(data.responses);
    }
  }, [data]);

  function handleNewResponse(newResp: any, tempId?: string) {
    setResponses((prev) => {
      if (tempId) return prev.map((r) => (r.id === tempId ? newResp : r));
      return [newResp, ...prev];
    });
    mutateTopic();
  }

  async function handleHighlightCreated() {
    // refresh inspector highlights when new one created
    mutate(`/api/topics/${topicId}/highlights`);
  }

  if (!topicId) return <div>Select a topic to view responses</div>;
  if (error) return <div className="text-red-500">Failed to load topic</div>;
  if (isLoading) return <div className="text-gray-500">Loading topic...</div>;

  const { topic } = data;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{topic.title}</h2>
      {responses.map((r) => (
        <ResponseCard
          key={r.id}
          resp={r}
          topicId={topicId}
          onHighlightCreated={handleHighlightCreated}
        />
      ))}
      {responses.length === 0 && (
        <div className="text-sm text-gray-400">No responses yet</div>
      )}
    </div>
  );
}

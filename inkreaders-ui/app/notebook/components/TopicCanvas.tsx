// app/notebook/components/TopicCanvas.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import ResponseCard from "./ResponseCard";
import ReplyBox from "./ReplyBox";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export type Response = {
  id: string;
  content: string;
  content_html?: string;
  authorType?: "ai" | "user";
  createdAt?: string;
  updatedAt?: string;
  status?: string;
};

export default function TopicCanvas({ topicId }: { topicId: string }) {
  const { data, error, isLoading, mutate } = useSWR(
    topicId ? `/api/topics/${topicId}` : null,
    fetcher
  );
  const [responses, setResponses] = useState<Response[]>([]);

  // Sync responses when SWR data changes
  useEffect(() => {
    if (data?.responses) {
      setResponses(data.responses);
    }
  }, [data]);

  function handleNewResponse(newResp: Response, tempId?: string) {
    setResponses((prev) => {
      if (tempId) {
        // replace optimistic temp
        return prev.map((r) => (r.id === tempId ? newResp : r));
      }
      return [newResp, ...prev];
    });
    mutate();
  }

  if (!topicId) return <div>Select a topic to view responses</div>;
  if (error) return <div className="text-red-500">Failed to load topic</div>;
  if (isLoading) return <div className="text-gray-500">Loading topic...</div>;

  const { topic } = data;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{topic.title}</h2>

      {responses.length === 0 && (
        <div className="text-sm text-gray-400">No responses yet</div>
      )}

      {responses.map((r) => (
        <ResponseCard key={r.id} resp={r} />
      ))}

      <ReplyBox topicId={topicId} onNew={handleNewResponse} />
    </div>
  );
}

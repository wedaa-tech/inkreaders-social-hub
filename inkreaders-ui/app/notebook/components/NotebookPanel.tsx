"use client";

import { useState } from "react";
import PromptBar from "./PromptBar";
import TopicCanvas from "./TopicCanvas";

export default function NotebookPanel() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  async function handlePrompt(query: string) {
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: query,
          prompt: query,
          tags: [],
          meta: { visibility: "private" },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSelectedTopic(data.topic.id);
    } catch (err) {
      console.error("Failed to create topic:", err);
      alert("Failed to create topic");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 relative">
      <h1 className="text-3xl font-bold">📒 Notebook</h1>
      <PromptBar onSubmit={handlePrompt} />

      {selectedTopic ? (
        <TopicCanvas topicId={selectedTopic} />
      ) : (
        <p className="text-gray-500">
          Ask a question above or open the topic navigator →
        </p>
      )}
    </div>
  );
}

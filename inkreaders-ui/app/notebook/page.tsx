// app/notebook/page.tsx
"use client";

import { useState } from "react";
import Shell from "@/app/components/Shell";
import PromptBar from "@/app/notebook/components/PromptBar";
import TopicCanvas from "@/app/notebook/components/TopicCanvas";
import TopicNavigator from "@/app/notebook/components/TopicNavigator";
import TopicNavigatorDrawer from "@/app/notebook/components/TopicNavigatorDrawer";

export default function NotebookPage() {
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
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Shell
        right={
          <div className="hidden md:flex md:flex-col w-80 border-l border-gray-200 bg-white">
            <div className="p-4 border-b">
              <h2 className="font-semibold mb-2">Topics</h2>
              <TopicNavigator onSelect={setSelectedTopic} />
            </div>
          </div>
        }
      >
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <h1 className="text-3xl font-bold">📒 Notebook</h1>
          <PromptBar onSubmit={handlePrompt} />

          {selectedTopic ? (
            <TopicCanvas topicId={selectedTopic} />
          ) : (
            <p className="text-gray-500">
              Ask a question above or select a topic →
            </p>
          )}
        </div>
      </Shell>
    </main>
  );
}

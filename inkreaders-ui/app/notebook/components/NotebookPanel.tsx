// app/notebook/components/NotebookPanel.tsx
"use client";

import { useState } from "react";
import PromptBar from "./PromptBar";
import TopicCanvas from "./TopicCanvas";
import InspectorPanel from "./InspectorPanel";
import TopicNavigator from "./TopicNavigator";
import TopicNavigatorDrawer from "./TopicNavigatorDrawer";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function NotebookPanel() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);

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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📒 Notebook</h1>

        {/* Desktop toggle */}
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="hidden md:flex items-center gap-2 rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          {navOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
          {navOpen ? "Hide Topics" : "Show Topics"}
        </button>

        {/* Mobile drawer */}
        <div className="md:hidden">
          <TopicNavigatorDrawer onSelect={setSelectedTopic} />
        </div>
      </div>

      <PromptBar onSubmit={handlePrompt} />

      <div className="flex gap-6">
        {/* Left sidebar (desktop only, collapsible) */}
        {navOpen && (
          <aside className="hidden md:block w-64 shrink-0 border-r border-gray-200 pr-4">
            <TopicNavigator onSelect={setSelectedTopic} />
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 space-y-6">
          {selectedTopic ? (
            <>
              <TopicCanvas topicId={selectedTopic} />
              {/* Inspector below canvas */}
              <InspectorPanel topicId={selectedTopic} />
            </>
          ) : (
            <p className="text-gray-500">
              Ask a question above or select a topic →
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

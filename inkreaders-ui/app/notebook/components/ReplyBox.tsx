// app/notebook/ReplyBox.tsx
"use client";

import { useState } from "react";

export default function ReplyBox({ topicId, onNew }: { topicId: string; onNew: (resp: any) => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    const newResp = {
      id: "temp-" + Date.now(),
      topicId,
      authorType: "user",
      content,
      contentHtml: content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic insert
    onNew(newResp);
    setLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();

      // Replace optimistic with saved response
      onNew(saved, newResp.id);
    } catch (err) {
      console.error("Failed to reply:", err);
      alert("Reply failed");
    } finally {
      setLoading(false);
      setContent("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
        disabled={loading}
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        {loading ? "Sending..." : "Reply"}
      </button>
    </form>
  );
}

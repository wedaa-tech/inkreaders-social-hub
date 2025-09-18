// app/notebook/components/ResponseCard.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export default function ResponseCard({ resp }: { resp: any }) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow hover:shadow-md transition"
    >
      <div className="flex justify-between mb-2">
        <span className="text-xs text-gray-500">
          {resp.status === "pending"
            ? "⏳ Generating…"
            : resp.authorType === "ai"
            ? "AI"
            : "You"}
        </span>
        {resp.createdAt && (
          <span className="text-xs text-gray-400">
            {new Date(resp.createdAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {resp.content || ""}
        </ReactMarkdown>
      </div>
    </div>
  );
}

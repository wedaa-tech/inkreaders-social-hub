// app/notebook/components/SectionCard.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Response } from "./NotebookCanvas";

export default function SectionCard({
  response,
  onClick,
}: {
  response: Response;
  onClick: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between mb-2">
        <span className="text-xs text-gray-500">
          {response.authorType === "ai" ? "AI" : "You"}
        </span>
        {response.createdAt && (
          <span className="text-xs text-gray-400">
            {new Date(response.createdAt).toLocaleString()}
          </span>
        )}
      </div>

    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {response.content}
      </ReactMarkdown>
    </div>
    </div>
  );
}

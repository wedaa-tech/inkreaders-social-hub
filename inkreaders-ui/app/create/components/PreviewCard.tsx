// app/create/components/PreviewCard.tsx
import React from "react";
import { FaRegLightbulb } from "@/app/create/components/icons";

export default function PreviewCard({ title, subtitle, body, tags }: { title: string; subtitle?: string; body: string; tags?: string[] }) {
  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
      <header className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-500">
          <FaRegLightbulb />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">You</span>
            <span className="truncate text-sm text-gray-500">@reader.example</span>
          </div>
          <div className="mt-1">
            <div className="font-semibold text-lg text-gray-900">{title}</div>
            {subtitle && <div className="text-sm text-gray-600 mt-0.5">{subtitle}</div>}
          </div>
        </div>
      </header>

      <div className="mt-4">
        <pre className="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700 font-sans">{body}</pre>
        {tags && tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 font-medium transition hover:bg-gray-200">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

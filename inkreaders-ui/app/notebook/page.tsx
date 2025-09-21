// app/notebook/page.tsx
"use client";


import Shell from "@/app/components/Shell";
import TopicNavigator from "@/app/notebook/components/TopicNavigator";
import NotebookPanel from "@/app/notebook/components/NotebookPanel";

export default function NotebookPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Shell right={<TopicNavigator onSelect={() => {}} />}>
        <NotebookPanel />
      </Shell>
    </main>
  );
}

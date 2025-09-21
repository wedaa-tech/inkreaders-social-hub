// app/create/page.tsx
"use client";

import React, { useState } from "react";
import Shell from "@/app/components/Shell";
import CreateTabs, { TabKey } from "@/app/create/components/CreateTabs";
import StoryComposer from "@/app/create/components/StoryComposer";
import ExerciseGenerator from "@/app/create/components/ExerciseGenerator";
import PackBuilder from "@/app/create/pack/PackBuilder";
import NotebookPage from "@/app/notebook/page";
import NotebookPanel from "@/app/notebook/components/NotebookPanel";

export default function CreatePage() {
  const [tab, setTab] = useState<TabKey>("exercise");

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Expand center to occupy center + right space while keeping left sidebar */}
      <Shell expandCenter>
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl border border-gray-200 shadow-xl mb-6">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
              Create & Share
            </h2>
            <p className="text-base text-gray-600 mt-2 max-w-2xl mx-auto">
              Write stories, generate exercises, and publish learning packs with
              AI. Create bite-sized study material and exam-ready packs in
              minutes.
            </p>

            {/* Tabs row — centered, placed below the description */}
            <div className="mt-5 flex justify-center">
              <div className="w-full sm:w-auto">
                <div className="mx-auto" style={{ minWidth: 280 }}>
                  <CreateTabs tab={tab} onChange={setTab} />
                </div>
              </div>
            </div>
          </div>
        </div>
          
        {tab === "story" && <StoryComposer />}
        {tab === "exercise" && <ExerciseGenerator />}
        {tab === "pack" && <PackBuilder />}
        {tab === "notebook" && <NotebookPanel />}


        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-3xl border border-teal-200 shadow-lg mt-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl text-teal-600">💡</div>
            <div>
              <h3 className="text-lg font-bold text-teal-800">
                Pro Tips for Polished Posts
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>
                  Add a one-line hook at the start of your story to capture
                  attention.
                </li>
                <li>
                  Keep exercises short (5–10 items) for higher completion rates.
                </li>
                <li>
                  Use relevant tags (<code>#Kids</code>, <code>#Quiz</code>,{" "}
                  <code>#CurrentAffairs</code>) to improve discovery.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Shell>
    </main>
  );
}

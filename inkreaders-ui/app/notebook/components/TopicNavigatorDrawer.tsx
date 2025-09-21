// app/notebook/components/TopicNavigatorDrawer.tsx
"use client";

import { useState } from "react";
import TopicNavigator from "./TopicNavigator";

export default function TopicNavigatorDrawer({
  onSelect,
  inspector,
}: {
  onSelect: (id: string) => void;
  inspector?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button (mobile only) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-lg bg-blue-600 text-white px-4 py-2 shadow-md md:hidden"
      >
        ☰ Notebook
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          ></div>

          {/* Drawer panel */}
          <div className="w-80 max-w-full bg-white h-full shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Notebook</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <h3 className="font-semibold mb-2">Topics</h3>
            <TopicNavigator
              onSelect={(id) => {
                onSelect(id);
                setOpen(false);
              }}
            />

            {inspector && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Inspector</h3>
                {inspector}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

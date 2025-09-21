// app/create/components/CreateTabs.tsx
import React from "react";
import { FaBook, FaPencilAlt, FaGlobeAmericas, FaBookOpen } from "@/app/create/components/icons";

export type TabKey = "story" | "exercise" | "pack" | "notebook";

export default function CreateTabs({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void; }) {
  const base = "flex-1 flex items-center justify-center rounded-full px-4 py-2 text-sm transition-all duration-300 font-medium";
  const active = "bg-white text-[color:var(--color-brand)] shadow-lg";
  const inactive = "text-gray-600 hover:bg-gray-100";

  return (
    <div className="flex items-center space-x-2 rounded-full bg-gray-100 p-1.5 shadow-inner">
      <button onClick={() => onChange("exercise")} className={`${base} ${tab === "exercise" ? active : inactive}`} type="button">
        <FaBook className="mr-2" /> Exercise
      </button>
      <button onClick={() => onChange("story")} className={`${base} ${tab === "story" ? active : inactive}`} type="button">
        <FaPencilAlt className="mr-2" /> Story
      </button>
      <button onClick={() => onChange("pack")} className={`${base} ${tab === "pack" ? active : inactive}`} type="button">
        <FaGlobeAmericas className="mr-2" /> Pack
      </button>
      <button
        onClick={() => onChange("notebook")}
        className={`${base} ${tab === "notebook" ? active : inactive}`}
        type="button"
      >
        <FaBookOpen className="mr-2" /> Notebook
      </button>

    </div>
  );
}

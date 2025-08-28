// app/components/Shell.tsx
"use client";

import { ReactNode } from "react";
import LeftSidebar from "./LeftSidebar";

export default function Shell({
  children,
  right,
}: {
  children: ReactNode;   // center column
  right?: ReactNode;     // optional right rail
}) {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4">
      {/* 1 col on mobile, 2 cols >=lg, 3 cols >=xl */}
      <div
        className="
          grid gap-0
          lg:grid-cols-[260px_minmax(0,1fr)]
          xl:grid-cols-[260px_minmax(0,1fr)_320px]
          border-x border-gray-200 bg-gray-50
        "
      >
        {/* Left */}
        <aside className="hidden lg:block border-r border-gray-200">
          <div className="sticky top-4 self-start">
            <LeftSidebar />
          </div>
        </aside>

        {/* Center */}
        <main className="min-w-0 space-y-4 border-r border-gray-200">
          {children}
        </main>

        {/* Right */}
        {right ? (
          <aside className="hidden xl:block">
            <div className="sticky top-4 self-start">{right}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// app/components/Shell.tsx
"use client";

import { ReactNode } from "react";
import LeftSidebar from "../left/LeftSidebar";

type ShellProps = {
  children: ReactNode; // center column content
  right?: ReactNode; // optional right rail
  /**
   * If true, the outer container uses full viewport width (no max-width).
   * Useful for feed / home where you want full-bleed content while retaining left sidebar.
   */
  fullWidth?: boolean;
  /**
   * If true AND `right` is not provided, the center content will expand to take the
   * space normally reserved for the right rail (i.e. center spans middle + right columns).
   * Useful for Create page where you want the middle + right to be a single wide canvas.
   */
  expandCenter?: boolean;
};

// app/components/centre/Shell.tsx
export default function Shell({
  children,
  right,
  fullWidth = false,
  expandCenter = false,
}: ShellProps) {
  const containerClass = fullWidth
    ? "mx-0 px-3 sm:px-4 w-full"
    : "mx-auto max-w-7xl px-3 sm:px-4";
  const mainColClass = right
    ? "min-w-0 space-y-4 border-r border-gray-200 overflow-y-auto"
    : expandCenter
    ? "min-w-0 space-y-4 border-r border-gray-200 overflow-y-auto xl:col-span-2"
    : "min-w-0 space-y-4 border-r border-gray-200 overflow-y-auto";

  return (
    <div className={`${containerClass} min-h-screen`}>
      <div
        className="
    grid gap-0 relative z-0
    lg:grid-cols-[260px_minmax(0,1fr)]
    xl:grid-cols-[260px_minmax(0,1fr)_320px]
    border-x border-gray-200 bg-gray-50
    min-h-screen
  "
      >
        {/* Left (sticky, non-scrolling) */}
        <aside className="hidden lg:block border-r border-gray-200 pt-4">
          <div className="sticky top-4">
            <LeftSidebar />
          </div>
        </aside>

        {/* Center (scrollable) */}
        <main className={`${mainColClass} pt-4`}>{children}</main>

        {/* Right (sticky, optional) */}
        {right ? (
          <aside className="hidden xl:block border-l border-gray-200 pt-4">
            <div className="sticky top-4">{right}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

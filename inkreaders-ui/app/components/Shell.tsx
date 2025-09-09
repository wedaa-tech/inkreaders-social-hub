// app/components/Shell.tsx
"use client";

import { ReactNode } from "react";
import LeftSidebar from "./LeftSidebar";

type ShellProps = {
  children: ReactNode;           // center column content
  right?: ReactNode;             // optional right rail
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

export default function Shell({ children, right, fullWidth = false, expandCenter = false }: ShellProps) {
  // outer wrapper classes — either constrained mx-auto max-w-7xl or full width
  const containerClass = fullWidth ? "mx-0 px-3 sm:px-4 w-full" : "mx-auto max-w-7xl px-3 sm:px-4";

  /**
   * Grid template:
   * - default: 2 cols at lg (left + center)
   * - xl: 3 cols (left + center + right)
   *
   * We'll keep the grid template fixed, but if expandCenter is true and right is not provided,
   * we'll let the center <main> span 2 columns on xl so it occupies middle + right area.
   */
  const mainColClass = right ? "min-w-0 space-y-4 border-r border-gray-200" : (expandCenter ? "min-w-0 space-y-4 border-r border-gray-200 xl:col-span-2" : "min-w-0 space-y-4 border-r border-gray-200");

  return (
    <div className={containerClass}>
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
        <main className={mainColClass}>
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

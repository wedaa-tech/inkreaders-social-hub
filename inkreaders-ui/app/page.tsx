// app/page.tsx
import LeftSidebar from "./components/LeftSidebar";
import RightSidebar from "./components/RightSidebar";
import FeedClient from "./components/FeedClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {/* 3-column grid on xl; 2 columns on lg; single column on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] gap-6 py-6">
          {/* Left */}
          <aside className="hidden lg:block">
            <div className="sticky top-4">
              <LeftSidebar />
            </div>
          </aside>

          {/* Middle (Feed) */}
          <section className="min-w-0">
            <FeedClient />
          </section>

          {/* Right */}
          <aside className="hidden xl:block">
            <div className="sticky top-4">
              <RightSidebar />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

// app/page.tsx
import Shell from "./components/centre/Shell";
import FeedClient from "./components/feed/FeedClient";   // ✅ updated import
import RightSidebar from "./components/right/RightSidebar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Shell right={<RightSidebar />}>
        <FeedClient />
      </Shell>
    </main>
  );
}

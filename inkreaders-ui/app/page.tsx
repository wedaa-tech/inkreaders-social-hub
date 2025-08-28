// app/page.tsx
import Shell from "./components/Shell";
import FeedClient from "./components/FeedClient";
import RightSidebar from "./components/RightSidebar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Shell right={<RightSidebar />}>
        <FeedClient />
      </Shell>
    </main>
  );
}

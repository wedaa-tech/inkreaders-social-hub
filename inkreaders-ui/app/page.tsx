// app/page.tsx
import Shell from "./components/centre/Shell";
import FeedClient from "./components/centre/FeedClient";
import RightSidebar from "./components/right/RightSidebar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* remove fullWidth so Home uses the same centered container as other pages */}
      <Shell right={<RightSidebar />}>
        <FeedClient />
      </Shell>
    </main>
  );
}

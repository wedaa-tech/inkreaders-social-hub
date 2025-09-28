// app/wishlist/page.tsx
import Shell from "@/app/components/centre/Shell";
import { TrendingBooks } from "@/app/components/right/TrendingBooks";

function ListCard({ id, title, by, items }: { id: string; title: string; by: string; items: number }) {
  return (
    <a href={`/lists/${id}`} className="block rounded-xl border p-3 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{title}</div>
          <div className="truncate text-sm text-gray-500">{by}</div>
        </div>
        <div className="shrink-0 text-sm text-gray-500">{items} items</div>
      </div>
    </a>
  );
}

export default function ListsPage() {
  const right = <TrendingBooks />;
  const staff = [{ id: "s1", title: "Staff Picks: August", by: "InkReaders", items: 10 }];
  const community = [
    { id: "c1", title: "Best Debuts (India)", by: "@books.jaya", items: 14 },
    { id: "c2", title: "Non-fiction to master 2025", by: "@reviewer.k", items: 12 },
  ];

  return (
    <Shell right={right}>
      <h2 className="text-xl font-semibold">Lists</h2>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
        Create your own reading list (coming soon)
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Staff Picks</h3>
          <a href="#" className="text-sm text-[color:var(--color-brand)] hover:underline">See all</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {staff.map(ListCard)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Community Lists</h3>
          <a href="#" className="text-sm text-[color:var(--color-brand)] hover:underline">See all</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {community.map(ListCard)}
        </div>
      </section>


    </Shell>
  );
}

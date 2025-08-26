// app/lists/page.tsx
export const dynamic = "force-dynamic";

type ReadingList = {
  id: string;
  title: string;
  by: string;            // curator
  items: number;
  tag?: string;
  description?: string;
};

async function getMockLists(): Promise<{ staff: ReadingList[]; community: ReadingList[]; series: ReadingList[]; publishers: ReadingList[]; }> {
  return {
    staff: [
      { id: "s1", title: "Staff Picks: August", by: "InkReaders", items: 10, description: "New & notable from Indian authors" },
    ],
    community: [
      { id: "c1", title: "Best Debuts (India)", by: "@books.jaya", items: 14, tag: "Debut" },
      { id: "c2", title: "Non-fiction to master 2025", by: "@reviewer.k", items: 12, tag: "NonFiction" },
    ],
    series: [
      { id: "sr1", title: "Start Reading Current Affairs", by: "InkReaders Guides", items: 6 },
    ],
    publishers: [
      { id: "p1", title: "Neo Press: Editor’s Choice", by: "Neo Press", items: 8 },
    ],
  };
}

function ListCard(l: ReadingList) {
  return (
    <a href={`/lists/${l.id}`} className="block rounded-xl border p-3 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{l.title}</div>
          <div className="truncate text-sm text-gray-500">{l.by}</div>
          {l.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{l.description}</p>}
        </div>
        <div className="shrink-0 text-sm text-gray-500">{l.items} items</div>
      </div>
      {l.tag && <div className="mt-2 inline-block rounded-full border px-2 py-0.5 text-xs text-gray-600">#{l.tag}</div>}
    </a>
  );
}

export default async function ListsPage() {
  const data = await getMockLists();
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Lists</h2>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Staff Picks</h3>
          <a href="#" className="text-sm text-[color:var(--color-brand)] hover:underline">See all</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.staff.map(ListCard)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Community Lists</h3>
          <a href="#" className="text-sm text-[color:var(--color-brand)] hover:underline">See all</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.community.map(ListCard)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Series</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.series.map(ListCard)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">Publisher Lists</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.publishers.map(ListCard)}
        </div>
      </section>

      {/* CTA – disabled until user mgmt */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
        Create your own reading list (coming soon)
      </div>
    </div>
  );
}

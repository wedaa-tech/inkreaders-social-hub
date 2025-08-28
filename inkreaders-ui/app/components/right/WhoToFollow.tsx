// app/components/right/WhoToFollow.tsx
export default function WhoToFollow() {
  const people = [
    { handle: "@books.jaya", name: "Jaya" },
    { handle: "@reviewer.k", name: "Karthik" },
    { handle: "@publisher.neo", name: "Neo Press" },
  ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-medium">Who to follow</h3>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.handle} className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="truncate text-sm text-gray-500">{p.handle}</div>
            </div>
            <button className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">
              Follow
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
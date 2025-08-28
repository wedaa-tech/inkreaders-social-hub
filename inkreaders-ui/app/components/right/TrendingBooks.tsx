// app/components/right/TrendingBooks.tsx
export function TrendingBooks() {
  const books = [
    { title: "The Quiet Library", mentions: 22 },
    { title: "Cities of Ink", mentions: 18 },
  ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-medium">Trending books</h3>
      <ul className="space-y-2">
        {books.map((b) => (
          <li key={b.title} className="flex items-center justify-between">
            <div className="truncate">{b.title}</div>
            <span className="text-xs text-gray-500">{b.mentions}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
// app/components/RightSidebar.tsx
export default function RightSidebar() {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <input
          placeholder="Search books, articles, people"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
      </div>

      {/* Trending books */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold">Trending books</h3>
        <ul className="space-y-3">
          {[
            ["Project Hail Mary", "Andy Weir"],
            ["Atomic Habits", "James Clear"],
            ["Kafka on the Shore", "Haruki Murakami"],
          ].map(([title, author]) => (
            <li key={title} className="flex items-start gap-3">
              <div className="h-12 w-9 rounded-md bg-gray-200"></div>
              <div className="min-w-0">
                <div className="truncate font-medium">{title}</div>
                <div className="truncate text-sm text-gray-500">by {author}</div>
                <a href="#" className="text-sm text-[color:var(--color-brand)] hover:underline">Add to list</a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Who to follow */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold">Who to follow</h3>
        <ul className="space-y-3">
          {["@papertrail", "@litdaily", "@nonfictionhub"].map((h) => (
            <li key={h} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{h.replace("@","")}</div>
                  <div className="truncate text-sm text-gray-500">{h}</div>
                </div>
              </div>
              <button className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium hover:bg-gray-200">
                Follow
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-500">
        <p>Powered by AT Protocol (coming soon)</p>
        <p className="mt-1">&copy; {new Date().getFullYear()} InkReaders</p>
      </div>
    </div>
  );
}

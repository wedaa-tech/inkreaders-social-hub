// app/components/LeftSidebar.tsx
export default function LeftSidebar() {
  return (
    <nav className="space-y-4">
      {/* Brand */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--color-brand)]"></div>
          <div>
            <h1 className="text-xl font-bold">InkReaders</h1>
            <p className="text-sm text-gray-500">read • share • connect</p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <ul className="space-y-1">
          {[
            ["Home", "🏠"],
            ["Discover", "🔎"],
            ["Lists", "📚"],
            ["Notifications", "🔔"],
            ["Profile", "👤"],
            ["Settings", "⚙️"],
          ].map(([label, icon]) => (
            <li key={label}>
              <a
                href="#"
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50"
              >
                <span className="text-lg">{icon}</span>
                <span className="font-medium">{label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="p-2">
          <a
            href="#compose"
            className="mt-2 block rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-center font-medium text-white hover:opacity-90"
          >
            New post
          </a>
        </div>
      </div>

      {/* Profile mini-card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200"></div>
          <div className="min-w-0">
            <p className="truncate font-semibold">You</p>
            <p className="truncate text-sm text-gray-500">@reader.example</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-gray-600">
          <span><strong className="text-gray-900">128</strong> following</span>
          <span><strong className="text-gray-900">342</strong> followers</span>
        </div>
      </div>
    </nav>
  );
}

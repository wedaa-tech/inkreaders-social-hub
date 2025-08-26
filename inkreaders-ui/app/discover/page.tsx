// app/discover/page.tsx
export const dynamic = "force-dynamic";

type Topic = { tag: string; count: number };
type Person = { did: string; handle: string; displayName: string; avatar?: string; common?: number };
type Book = { title: string; authors: string[]; mentions: number };
type Article = { title: string; source: string; uri: string };
type Event = { title: string; startsAt: string; location?: string; url?: string };

async function getMockDiscover() {
  // Replace with real fetches later
  const topics: Topic[] = [
    { tag: "CurrentAffairs", count: 142 },
    { tag: "BookLaunch", count: 87 },
    { tag: "IndieAuthors", count: 64 },
    { tag: "NonFiction", count: 51 },
    { tag: "SciFi", count: 44 },
  ];
  const people: Person[] = [
    { did: "did:plc:1", handle: "@books.jaya", displayName: "Jaya", common: 8 },
    { did: "did:plc:2", handle: "@reviewer.k", displayName: "Karthik", common: 7 },
    { did: "did:plc:3", handle: "@publisher.neo", displayName: "Neo Press", common: 6 },
  ];
  const books: Book[] = [
    { title: "The Quiet Library", authors: ["Anita Rao"], mentions: 22 },
    { title: "Cities of Ink", authors: ["R. Mehta"], mentions: 18 },
    { title: "Reading the News", authors: ["A. Banerjee"], mentions: 14 },
  ];
  const articles: Article[] = [
    { title: "How to build a reading habit", source: "inkreaders.blog", uri: "https://example.com/a1" },
    { title: "Publishing trends 2025", source: "publisher.today", uri: "https://example.com/a2" },
  ];
  const events: Event[] = [
    { title: "Bangalore Book Launch: Cities of Ink", startsAt: new Date(Date.now()+86400000).toISOString(), location: "Blr", url: "#" },
    { title: "Delhi Lit Meetup", startsAt: new Date(Date.now()+3*86400000).toISOString(), location: "Delhi", url: "#" },
  ];
  return { topics, people, books, articles, events };
}

export default async function DiscoverPage() {
  const { topics, people, books, articles, events } = await getMockDiscover();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Discover</h2>

      {/* Trending topics */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Trending topics</h3>
        <div className="flex flex-wrap gap-2">
          {topics.map(t => (
            <a
              key={t.tag}
              href={`/search?q=%23${encodeURIComponent(t.tag)}`}
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
            >
              #{t.tag} <span className="text-gray-500">· {t.count}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Who to follow */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Who to follow</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map(p => (
            <li key={p.did} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.displayName}</div>
                  <div className="truncate text-sm text-gray-500">{p.handle}</div>
                </div>
              </div>
              <button className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">Follow</button>
            </li>
          ))}
        </ul>
      </section>

      {/* Trending books */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Trending books</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map(b => (
            <div key={b.title} className="rounded-xl border p-3">
              <div className="text-base font-semibold">{b.title}</div>
              <div className="text-sm text-gray-600">{b.authors.join(", ")}</div>
              <div className="mt-1 text-xs text-gray-500">{b.mentions} mentions</div>
              <div className="mt-2 flex gap-2">
                <button className="rounded-full border px-2 py-1 text-sm hover:bg-gray-50">Want</button>
                <button className="rounded-full border px-2 py-1 text-sm hover:bg-gray-50">Reading</button>
                <button className="rounded-full border px-2 py-1 text-sm hover:bg-gray-50">Finished</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fresh articles */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Fresh articles</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map(a => (
            <a key={a.uri} href={a.uri} target="_blank" rel="noreferrer" className="rounded-xl border p-3 hover:bg-gray-50">
              <div className="font-medium">{a.title}</div>
              <div className="text-sm text-gray-500">{a.source}</div>
            </a>
          ))}
        </div>
      </section>

      {/* Upcoming events */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-medium">Upcoming events</h3>
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-gray-500">
                  {new Date(e.startsAt).toLocaleString()} {e.location ? `· ${e.location}` : ""}
                </div>
              </div>
              <a href={e.url ?? "#"} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">Details</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

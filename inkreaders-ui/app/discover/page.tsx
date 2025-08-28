// app/discover/page.tsx
import Shell from "@/app/components/Shell";
import WhoToFollow from "@/app/components/right/WhoToFollow";
import { TrendingBooks } from "@/app/components/right/TrendingBooks";
import Link from "next/link";

/* -------------------- Mock Data (replace later) -------------------- */
const topics = [
  { tag: "CurrentAffairs", count: 142 },
  { tag: "BookLaunch", count: 87 },
  { tag: "IndieAuthors", count: 64 },
  { tag: "NonFiction", count: 51 },
  { tag: "SciFi", count: 44 },
  { tag: "Poetry", count: 31 },
];

const staffLists = [
  {
    id: "s1",
    title: "Staff Picks · August",
    by: "InkReaders",
    items: 10,
    description: "New & notable reads from Indian authors.",
  },
];

const communityLists = [
  { id: "c1", title: "Best Debuts (India)", by: "@books.jaya", items: 14, tag: "Debut" },
  { id: "c2", title: "Non-fiction to master 2025", by: "@reviewer.k", items: 12, tag: "NonFiction" },
];

const freshArticles = [
  { title: "How to build a reading habit", source: "inkreaders.blog", uri: "#" },
  { title: "Publishing trends 2025", source: "publisher.today", uri: "#" },
  { title: "Why readers love small presses", source: "readernews.in", uri: "#" },
];

const events = [
  { title: "Bangalore Book Launch: Cities of Ink", startsAt: new Date(Date.now() + 86400000).toISOString(), location: "Bengaluru", url: "#" },
  { title: "Delhi Lit Meetup", startsAt: new Date(Date.now() + 3 * 86400000).toISOString(), location: "Delhi", url: "#" },
];

/* -------------------- Small UI helpers -------------------- */

function StickySearchBar() {
  return (
    <div className="sticky top-0 z-10">
      <div className="bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
        <form action="/search" method="GET" className="p-2">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2">
            <span className="text-lg">🔎</span>
            <input
              name="q"
              placeholder="Search books, people, articles, topics…"
              className="w-full bg-transparent outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1 text-sm font-medium text-white hover:opacity-90"
            >
              Search
            </button>
          </div>
        </form>
        <div className="border-b border-gray-200" />
      </div>
    </div>
  );
}

function Section({
  title,
  actionHref,
  actionText = "See all",
  children,
}: {
  title: string;
  actionHref?: string;
  actionText?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        {actionHref ? (
          <Link href={actionHref} className="text-sm text-[color:var(--color-brand)] hover:underline">
            {actionText}
          </Link>
        ) : (
          <span />
        )}
      </div>
      {children}
    </section>
  );
}

function TopicChip({ tag, count }: { tag: string; count: number }) {
  return (
    <Link
      href={`/search?q=%23${encodeURIComponent(tag)}`}
      className="group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition hover:bg-gray-50"
      title={`#${tag}`}
    >
      <span className="font-medium">#{tag}</span>
      <span className="text-xs text-gray-500 group-hover:text-gray-600">{count}</span>
    </Link>
  );
}

function ListCard({
  id,
  title,
  by,
  items,
  tag,
  description,
}: {
  id: string;
  title: string;
  by: string;
  items: number;
  tag?: string;
  description?: string;
}) {
  return (
    <Link href={`/lists/${id}`} className="block rounded-xl border p-3 transition hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{title}</div>
          <div className="truncate text-sm text-gray-500">{by}</div>
          {description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{description}</p>}
        </div>
        <div className="shrink-0 text-sm text-gray-500">{items} items</div>
      </div>
      {tag && (
        <div className="mt-2 inline-block rounded-full border px-2 py-0.5 text-xs text-gray-600">
          #{tag}
        </div>
      )}
    </Link>
  );
}

function ArticleCard({ a }: { a: { title: string; source: string; uri: string } }) {
  return (
    <a href={a.uri} target="_blank" rel="noreferrer" className="block rounded-xl border p-3 transition hover:bg-gray-50">
      <div className="font-medium">{a.title}</div>
      <div className="text-sm text-gray-500">{a.source}</div>
    </a>
  );
}

function EventRow({ e }: { e: { title: string; startsAt: string; location?: string; url?: string } }) {
  return (
    <li className="flex items-center justify-between rounded-xl border p-3">
      <div>
        <div className="font-medium">{e.title}</div>
        <div className="text-sm text-gray-500">
          {new Date(e.startsAt).toLocaleString()} {e.location ? `· ${e.location}` : ""}
        </div>
      </div>
      <a href={e.url ?? "#"} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50">
        Details
      </a>
    </li>
  );
}

/* -------------------- Page -------------------- */

export default function DiscoverPage() {
  const right = (
    <>
      <WhoToFollow />
      <TrendingBooks />
    </>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <Shell right={right}>
        {/* Sticky full-width search bar */}
        <StickySearchBar />

        {/* Trending topics */}
        <Section title="Trending topics" actionHref="/search">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <TopicChip key={t.tag} {...t} />
            ))}
          </div>
        </Section>

        {/* Lists — Staff Picks */}
        <Section title="Staff Picks" actionHref="#">
          <div className="grid gap-3 sm:grid-cols-2">
            {staffLists.map((l) => (
              <ListCard key={l.id} {...l} />
            ))}
          </div>
        </Section>

        {/* Lists — Community */}
        <Section title="Community Lists" actionHref="#">
          <div className="grid gap-3 sm:grid-cols-2">
            {communityLists.map((l) => (
              <ListCard key={l.id} {...l} />
            ))}
          </div>
        </Section>

        {/* Fresh articles */}
        <Section title="Fresh articles" actionHref="/search?q=article">
          <div className="grid gap-3 sm:grid-cols-2">
            {freshArticles.map((a) => (
              <ArticleCard key={a.title} a={a} />
            ))}
          </div>
        </Section>

        {/* Upcoming events */}
        <Section title="Upcoming events" actionHref="/events">
          <ul className="space-y-2">
            {events.map((e, i) => (
              <EventRow key={i} e={e} />
            ))}
          </ul>
        </Section>

        {/* CTA (future): create list */}
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
          Create your own reading list (coming soon)
        </div>
      </Shell>
    </main>
  );
}

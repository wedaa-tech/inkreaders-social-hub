// app/exercises/mine/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedPage from "@/app/components/auth/ProtectedPage";
import Shell from "@/app/components/centre/Shell"; // 👈 Import Shell
import { apiFetch, apiFetchJson } from "@/lib/api";

type ExerciseSet = {
  id: string;
  title: string;
  format: string;
  created_at: string;
  visibility: string;
  at_uri?: string | null;
  feed_uri?: string | null;
  meta?: {
    difficulty?: string;
    language?: string;
  };
};

export default function ExercisesMinePage() {
  const [items, setItems] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  async function fetchMine() {
      setLoading(true);
      try {
        const data = await apiFetchJson<{ items: ExerciseSet[] }>("/api/exercises/mine", {
          cache: "no-store",
        });
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  
    useEffect(() => {
      fetchMine();
    }, []);
  
    function blueskyUrl(it: ExerciseSet) {
      const uri = it.feed_uri || it.at_uri;
      if (!uri) return "#";
      if (/^https?:\/\//i.test(uri)) return uri;
      if (uri.startsWith("at://")) {
        const parts = uri.split("/");
        if (parts.length >= 5) {
          const did = parts[2];
          const rkey = parts[4];
          return `https://bsky.app/profile/${did}/post/${rkey}`;
        }
      }
      return "#";
    }
  
    async function handlePublish(id: string) {
      setBusy(id + "-pub");
      try {
        const res = await apiFetch(`/api/exercises/${id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_feed: true, allow_remix: true }),
        });
        if (!res.ok) return alert("Publish failed");
  
        const pub = (await res.json()) as { at_uri?: string; feed_uri?: string };
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, at_uri: pub.at_uri ?? it.at_uri, feed_uri: pub.feed_uri ?? it.feed_uri }
              : it
          )
        );
        await fetchMine();
      } finally {
        setBusy(null);
      }
    }
  
    async function handleRemix(id: string) {
      setBusy(id + "-remix");
      try {
        const res = await apiFetch(`/api/exercises/${id}/remix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transform: {
              increase_difficulty: true,
              reduce_count_to: 0,
              switch_format_to: "",
            },
            note: "User requested remix from Mine page",
          }),
        });
        if (!res.ok) return alert("Remix failed");
  
        const data = await res.json();
        const newId = data.derived_set_id;
        if (newId) router.push(`/exercises/${newId}/preview`);
      } finally {
        setBusy(null);
      }
    }

  return (
    // 👈 Wrap with Shell
    <ProtectedPage>
      {/* Add Shell here to integrate with the main layout */}
      <Shell expandCenter={true}>
        {/* Your existing content starts here */}
        <div className="py-2 space-y-6"> {/* Reduced top/bottom padding */}
          {/* Header + New Exercise */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-4"> {/* Added border-b */}
            <h1 className="text-3xl font-bold text-gray-900">My Exercises 📝</h1>
            <Link
              href="/exercises/generate"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 transition-colors duration-200 text-sm" // Changed to rounded-full, text-sm
            >
              + New Exercise
            </Link>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <p className="text-lg text-gray-600 animate-spin">
                <svg className="h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0014 4.582m-4.004 0A7.96 7.96 0 004 12c0 4.418 3.582 8 8 8s8-3.582 8-8V4h-4z"></path></svg>
              </p>
              <p className="text-lg text-gray-600 ml-3">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 text-lg py-12 border-2 border-dashed border-gray-200 rounded-xl p-8 bg-white">
              <p>No exercises yet. Try generating one! ✨</p>
            </div>
          ) : (
            // Beautified List
            <ul className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2"> {/* Changed to 1-2 columns for a wider content area */}
              {items.map((it) => {
                const hasBsky = Boolean(it.feed_uri) || Boolean(it.at_uri);
                return (
                  <li
                    key={it.id}
                    className="bg-white border border-gray-100 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-300" // Elevated styling
                  >
                    <div className="flex justify-between items-start">
                      <Link
                          href={`/exercises/${it.id}/preview`}
                          className="flex-1 min-w-0"
                      >
                        <h2 className="text-xl font-extrabold text-gray-900 truncate hover:text-blue-600 transition-colors leading-snug">
                          {it.title}
                        </h2>
                      </Link>
                      <span className={`ml-4 text-xs font-bold px-2 py-0.5 rounded-full ${it.visibility === 'public' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {it.visibility?.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-sm text-gray-500 mt-2 flex items-center gap-3">
                        <span className="font-semibold text-blue-600">{it.format?.toUpperCase()}</span>
                        {it.meta?.difficulty && (
                          <span className="capitalize border-l pl-3">{it.meta.difficulty}</span>
                        )}
                        {it.meta?.language && (
                          <span className="border-l pl-3 uppercase">{it.meta.language}</span>
                        )}
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-2 border-t border-dashed pt-2">
                      Created: {new Date(it.created_at).toLocaleDateString()}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm border-t pt-3">
                      <Link
                        href={`/exercises/${it.id}/preview`}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors shadow-md"
                      >
                        Start 🚀
                      </Link>

                      {!hasBsky ? (
                        <button
                          onClick={() => handlePublish(it.id)}
                          disabled={busy === it.id + "-pub"}
                          className="inline-flex items-center px-4 py-2 bg-green-50 text-green-700 font-medium rounded-full hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-green-300"
                        >
                          {busy === it.id + "-pub" ? "Publishing..." : "Publish to Feed"}
                        </button>
                      ) : (
                        <a
                          href={blueskyUrl(it)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-medium rounded-full hover:bg-green-600 transition-colors shadow-md"
                        >
                          View on Bluesky 🔗
                        </a>
                      )}

                      <button
                        onClick={() => handleRemix(it.id)}
                        disabled={busy === it.id + "-remix"}
                        className="inline-flex items-center px-4 py-2 bg-gray-50 text-gray-700 font-medium rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
                      >
                        {busy === it.id + "-remix" ? "Remixing..." : "Remix/Evolve 🔄"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Shell> {/* 👈 End Shell */}
    </ProtectedPage>
  );
}
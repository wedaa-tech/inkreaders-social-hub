// app/components/LeftSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Me = { did: string; handle: string; pds: string; avatar_url?: string; display_name?: string };

export default function LeftSidebar() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          const j = await res.json();
          setMe(j);
        } else {
          setMe(null); // 401 = not logged in
        }
      } catch {
        setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    // refresh UI state (and any server-rendered bits)
    window.location.reload();
  }

  const NAV = [
    { label: "Home", icon: "🏠", href: "/" },
    { label: "Discover", icon: "🔎", href: "/discover" },
    { label: "Lists", icon: "📚", href: "/lists" },
    { label: "Create", icon: "✍️", href: "/create" }, // your new hub
    { label: "Notifications", icon: "🔔", href: "/notifications" },
    { label: "Profile", icon: "👤", href: me ? `/u/${me.handle}` : "/login" },
    { label: "Settings", icon: "⚙️", href: "/settings" },
  ];

  return (
    <nav className="space-y-4">
      {/* Brand */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--color-brand)]" />
          <div>
            <h1 className="text-xl font-bold">InkReaders</h1>
            <p className="text-sm text-gray-500">read • share • connect</p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
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

      {/* Profile mini-card (auth-aware) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        ) : me ? (
          <>
            <div className="flex items-center gap-3">
              {me.avatar_url ? (
                <img
                  src={me.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200" />
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{me.display_name || me.handle}</p>
                <p className="truncate text-sm text-gray-500">@{me.handle}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Link
                href={`/u/${me.handle}`}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
              >
                View profile
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                type="button"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Welcome</div>
              <div className="text-sm text-gray-600">Sign in to post & engage</div>
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

// app/components/LeftSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Modal from "../Modal";
import ConnectBlueskyForm from "../ConnectBlueskyForm";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Me = {
  did: string;
  handle: string;
  pds: string;
  avatar_url?: string;
  display_name?: string;
};

export default function LeftSidebar() {
  const { data: session, status } = useSession(); // NextAuth (OAuth) state
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Check Bluesky connection (ink_sid)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        if (!alive) return;
        if (res.ok) setMe(await res.json());
        else setMe(null);
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function logoutBluesky() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    // Only logs out Bluesky connection (keeps Google session)
    setMe(null);
  }

  // inside LeftSidebar.tsx
  const NAV = [
    { label: "Home", icon: "🏠", href: "/" },
    //  { label: "Discover", icon: "🔎", href: "/discover" },
    //  { label: "Wishlist", icon: "📚", href: "/wishlist" },
    { label: "Create", icon: "✍️", href: "/create" },
    { label: "Notebook", icon: "📒", href: "/notebook" }, // 👈 new entry
    { label: "Exercises", icon: "📝", href: "/exercises/mine" }, // 👈 added
    //  { label: "Notifications", icon: "🔔", href: "/notifications" },
    {
      label: "Profile",
      icon: "👤",
      href: me ? `/u/${me.handle}` : "/settings",
    },
    { label: "Settings", icon: "⚙️", href: "/settings" },
  ];

  const isOAuth = status === "authenticated";
  const userName = session?.user?.name || session?.user?.email || "You";

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

      {/* Profile mini-card (OAuth + Bluesky awareness) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {status === "loading" || loadingMe ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        ) : !isOAuth ? (
          // Not signed into InkReaders (OAuth)
          <div className="space-y-3">
            <div>
              <div className="font-semibold">Welcome</div>
              <div className="text-sm text-gray-600">
                Sign in to post & engage
              </div>
            </div>
            <Link
              href="/login"
              className="w-full block text-center rounded-lg bg-[color:var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        ) : (
          // Signed into InkReaders
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{userName}</p>
                {me ? (
                  <p className="truncate text-sm text-gray-500">
                    @{me.handle} (Bluesky)
                  </p>
                ) : (
                  <p className="truncate text-sm text-gray-500">
                    Not connected to Bluesky
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              type="button"
            >
              Logout
            </button>
          </div>
        )}

        {/* Bluesky Connect always visible */}
        <div className="mt-3">
          {!me ? (
            <button
              onClick={() => setShowConnectModal(true)}
              className="w-full rounded-lg bg-[color:var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Connect Bluesky
            </button>
          ) : (
            <button
              onClick={logoutBluesky}
              className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              type="button"
            >
              Disconnect Bluesky
            </button>
          )}
        </div>
      </div>

      {/* Bluesky Connect Modal */}
      {showConnectModal && (
        <Modal onClose={() => setShowConnectModal(false)}>
          <h1 className="text-xl font-bold mb-4">Connect Bluesky</h1>
          <ConnectBlueskyForm
            onSuccess={() => setShowConnectModal(false)}
            onCancel={() => setShowConnectModal(false)}
          />
        </Modal>
      )}
    </nav>
  );
}

// LeftSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Modal from "../ui/Modal";
import ConnectBlueskyForm from "@/app/bluesky/ConnectBlueskyForm";
import SignInModal from "@/app/components/auth/SignInModal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Me = {
  did?: string;
  handle?: string;
  pds?: string;
  avatar_url?: string;
  display_name?: string;
  user_id?: string;
};

export default function LeftSidebar() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // helper to fetch /me
  async function fetchMe() {
    setLoadingMe(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMe(data);
      } else {
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }

  // run once on mount
  useEffect(() => {
    fetchMe();
  }, []);

  // 🔧 listen for custom auth event from SignInModal
  useEffect(() => {
    const handler = () => {
      console.log("🔔 auth changed, refetching /me");
      fetchMe();
    };
    window.addEventListener("ink:auth-changed", handler);
    return () => window.removeEventListener("ink:auth-changed", handler);
  }, []);

  async function logoutAll() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setMe(null);
    // 🔧 also notify rest of app
    window.dispatchEvent(new CustomEvent("ink:auth-changed"));
  }

  const NAV = [
    { label: "Home", icon: "🏠", href: "/" },
    { label: "Create", icon: "✍️", href: "/create" },
    { label: "Notebook", icon: "📒", href: "/notebook" },
    { label: "Exercises", icon: "📝", href: "/exercises/mine" },
    { label: "Profile", icon: "👤", href: me ? `/u/${me.handle}` : "/settings" },
    { label: "Settings", icon: "⚙️", href: "/settings" },
  ];

  const isLoggedIn = !!me;
  const userName =
    (me && (me.display_name || me.handle || me.user_id)) || "You";

  return (
    <nav className="space-y-4">
      {/* Brand */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[color:var(--color-brand)]" />
          <div>
            <h1 className="text-xl font-bold leading-tight">InkReaders</h1>
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

      {/* Profile mini-card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loadingMe ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        ) : !isLoggedIn ? (
          <div className="space-y-3">
            <div>
              <div className="font-semibold">Welcome</div>
              <div className="text-sm text-gray-600">
                Sign in to post & engage
              </div>
            </div>
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full block text-center rounded-lg bg-[color:var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{userName}</p>
                {me && me.handle ? (
                  <p className="truncate text-sm text-gray-500">
                    @{me.handle} (Bluesky)
                  </p>
                ) : (
                  <p className="truncate text-sm text-gray-500">
                    Connected (no Bluesky)
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={logoutAll}
              className="w-full rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              type="button"
            >
              Logout
            </button>
          </div>
        )}

        {/* Bluesky Connect */}
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
              onClick={async () => {
                await fetch(`${API_BASE}/api/auth/logout`, {
                  method: "POST",
                  credentials: "include",
                });
                setMe(null);
                window.dispatchEvent(new CustomEvent("ink:auth-changed"));
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              type="button"
            >
              Disconnect Bluesky
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showConnectModal && (
        <Modal onClose={() => setShowConnectModal(false)}>
          <h1 className="text-xl font-bold mb-4">Connect Bluesky</h1>
          <ConnectBlueskyForm
            onSuccess={() => setShowConnectModal(false)}
            onCancel={() => setShowConnectModal(false)}
          />
        </Modal>
      )}

      <SignInModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </nav>
  );
}

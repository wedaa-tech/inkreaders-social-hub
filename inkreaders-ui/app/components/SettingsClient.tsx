// app/components/SettingsClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { did: string; handle: string; pds: string };
type Profile = {
  did: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  remote: { displayName: string; avatar: string; description: string };
};
type Prefs = { defaultFeed: "app" | "user" };

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function SettingsClient() {
  const router = useRouter(); // ✅ move hook INSIDE the component

  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ defaultFeed: "app" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r1 = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        if (r1.ok) setMe(await r1.json());
        else setMe(null);

        if (r1.ok) {
          const r2 = await fetch(`${API}/api/profile`, { credentials: "include" });
          if (r2.ok) setProfile(await r2.json());

          const r3 = await fetch(`${API}/api/prefs`, { credentials: "include" });
          if (r3.ok) setPrefs(await r3.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function connectBluesky() {
    router.push("/connect-bsky");
  }
  async function disconnectBluesky() {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    window.location.reload();
  }
  async function saveProfile(p: Partial<Profile>) {
    await fetch(`${API}/api/profile`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        bio: p.bio,
      }),
    });
  }
  async function savePrefs(next: Prefs) {
    await fetch(`${API}/api/prefs`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setPrefs(next);
  }

  async function syncFromRemote() {
  await fetch(`${API}/api/profile/sync-from-remote`, { method: "POST", credentials: "include" });
  // refetch
  const r2 = await fetch(`${API}/api/profile`, { credentials: "include" });
  if (r2.ok) setProfile(await r2.json());
}

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Bluesky connection */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Bluesky Connection</h2>
        {!me ? (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-gray-600">Not connected.</p>
            <button
              onClick={connectBluesky}
              className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1 text-white"
            >
              Connect Bluesky
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-gray-700">
              Connected as <strong>{me.handle}</strong> ({me.did})
            </div>
            <button
              onClick={disconnectBluesky}
              className="rounded-lg border px-3 py-1 hover:bg-gray-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>

      {/* Profile */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        {!me ? (
          <p className="mt-2 text-gray-600">Connect Bluesky to manage profile.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-gray-600">Display name</span>
                <input
                  defaultValue={profile?.displayName ?? ""}
                  onBlur={(e) => saveProfile({ displayName: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Avatar URL</span>
                <input
                  defaultValue={profile?.avatarUrl ?? ""}
                  onBlur={(e) => saveProfile({ avatarUrl: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>
            </div>
            <label className="block mt-3">
              <span className="text-sm text-gray-600">Bio</span>
              <textarea
                defaultValue={profile?.bio ?? ""}
                onBlur={(e) => saveProfile({ bio: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </label>

            {/* Remote preview */}
            {profile?.remote && (
              <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-sm text-gray-600">
                <div className="font-medium">Bluesky (remote):</div>
                <div>Display: {profile.remote.displayName || "—"}</div>
                <div>Avatar: {profile.remote.avatar || "—"}</div>
                <div>Bio: {profile.remote.description || "—"}</div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-gray-600">Default feed tab:</span>
          <button
            onClick={() => savePrefs({ defaultFeed: "app" })}
            className={
              "rounded-lg px-3 py-1 text-sm " +
              (prefs.defaultFeed === "app"
                ? "bg-[color:var(--color-brand)] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            For You
          </button>
          <button
            onClick={() => savePrefs({ defaultFeed: "user" })}
            className={
              "rounded-lg px-3 py-1 text-sm " +
              (prefs.defaultFeed === "user"
                ? "bg-[color:var(--color-brand)] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            Following (You)
          </button>
          <button onClick={syncFromRemote} className="rounded-lg border px-3 py-1 hover:bg-gray-50">
  Sync from Bluesky
</button>
        </div>
      </section>
    </div>
  );
}

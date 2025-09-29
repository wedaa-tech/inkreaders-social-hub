// app/connect-bsky/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function ConnectBlueskyPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");     // handle or email
  const [appPassword, setAppPassword] = useState("");   // Bluesky app password
  const [pdsBase, setPdsBase] = useState("https://bsky.social");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, appPassword, pdsBase }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Login failed (${res.status})`);
      }
      // success → back to settings
      router.push("/settings");
      router.refresh?.();
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 lg:px-6 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h1 className="text-xl font-bold">Connect Bluesky</h1>
          <p className="mt-1 text-sm text-gray-600">
            Sign in with your Bluesky <em>app password</em> to let InkReaders post and fetch your following feed.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-600">Handle or email</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="yourname.bsky.social or email"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600">App password</label>
              <input
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create one in Bluesky → Settings → App Passwords.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-600">PDS base (optional)</label>
              <input
                value={pdsBase}
                onChange={(e) => setPdsBase(e.target.value)}
                placeholder="https://bsky.social"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                disabled={submitting}
                type="submit"
                className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Connecting…" : "Connect"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-xl border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium">Privacy note</p>
            <p>
              Your access/refresh tokens are encrypted at rest. On localhost, the session cookie is not Secure so your browser will store it on <code>http://</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

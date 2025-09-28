"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function ConnectBlueskyForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [appPassword, setAppPassword] = useState("");
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
      if (!res.ok) throw new Error(await res.text().catch(() => `Login failed (${res.status})`));

      // success → close modal or go to settings
      onSuccess?.();
      router.refresh?.();
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex items-center gap-3">
        <button disabled={submitting} type="submit" className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white disabled:opacity-60">
          {submitting ? "Connecting…" : "Connect"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

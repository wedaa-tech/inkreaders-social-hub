// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",          // <-- send/receive ink_sid cookie
          body: JSON.stringify({ identifier, appPassword }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed (${res.status})`);
      }
      router.push("/");                   // redirect after success
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h1 className="text-xl font-semibold">Sign in with Bluesky</h1>
          <form onSubmit={submit} className="space-y-3">
            <input value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="@handle or email" className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
            <input type="password" value={appPassword} onChange={(e)=>setAppPassword(e.target.value)} placeholder="App password" className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]" />
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
            <button disabled={loading} className="w-full rounded-xl bg-[color:var(--color-brand)] px-4 py-2 font-medium text-white disabled:opacity-60">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function SettingsPage() {
  const [identifier, setIdentifier] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",              // <-- required for ink_sid cookie
        body: JSON.stringify({ identifier, appPassword }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed (${res.status})`);
      setMsg("Connected to Bluesky ✔️");
      setIdentifier(""); setAppPassword("");
    } catch (e: any) {
      setMsg(e.message || "Failed to connect");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-lg font-semibold">Connect Bluesky</h2>
          <p className="text-sm text-gray-600">
            Use your Bluesky <strong>App Password</strong> (Settings → App passwords).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={identifier} onChange={(e)=>setIdentifier(e.target.value)}
              placeholder="your.handle (no @) or email"
              className="rounded-xl border px-3 py-2" />
            <input type="password" value={appPassword} onChange={(e)=>setAppPassword(e.target.value)}
              placeholder="App password (xxxx-xxxx-xxxx-xxxx)"
              className="rounded-xl border px-3 py-2" />
          </div>
          <div className="flex justify-end">
            <button onClick={connect} disabled={loading}
              className="rounded-xl bg-[color:var(--color-brand)] px-4 py-2 text-white disabled:opacity-60">
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
          {msg && <div className="text-sm text-gray-700">{msg}</div>}
        </div>
      </div>
    </main>
  );
}

// lib/authClient.ts
const API_BASE = typeof window !== "undefined" && (process.env.NEXT_PUBLIC_API_BASE ?? "") ? process.env.NEXT_PUBLIC_API_BASE : "";

export function startRedirectLogin(provider: "github" | "google") {
  const base = API_BASE || "";
  // if API_BASE missing, fallback to same-origin (dev pitfall)
  const url = `${base}/api/auth/oauth/${provider}/start`;
  window.location.href = url;
}

export async function apiGet(path: string, opts: RequestInit = {}) {
  const base = API_BASE || "";
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${url} failed: ${res.status} ${text}`);
  }
  return res.json();
}

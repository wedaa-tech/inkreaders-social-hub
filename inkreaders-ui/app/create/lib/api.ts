// app/create/lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

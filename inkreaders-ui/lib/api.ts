// lib/api.ts

// If NEXT_PUBLIC_API_BASE is set and non-empty, use it.
// Otherwise default to "" so requests go through Next.js proxy (/api/*).
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE !== undefined &&
  process.env.NEXT_PUBLIC_API_BASE.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_BASE
    : "";

/**
 * Auth-aware fetch wrapper.
 * Always sends cookies. DOES NOT redirect on 401.
 * Protected pages/components should decide what to do if 401.
 */
export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
  });
  return res;
}

/** Convenience JSON helper (no redirect). */
export async function apiFetchJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    // Provide a readable error text for callers who want to catch
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

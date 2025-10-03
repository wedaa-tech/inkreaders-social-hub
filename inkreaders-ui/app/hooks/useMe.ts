// lib/hooks/useMe.ts (or app/hooks/useMe.ts, depending on where you keep it)
"use client";

import { useEffect, useState } from "react";
import { apiFetchJson } from "@/lib/api";

export type Me = {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
  has_bluesky?: boolean;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetchJson<Me>("/api/auth/me");
        if (alive) setMe(data);
      } catch {
        if (alive) setMe(null); // if 401, just null
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { me, loading };
}

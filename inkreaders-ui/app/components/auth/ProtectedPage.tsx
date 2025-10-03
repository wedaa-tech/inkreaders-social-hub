// app/components/auth/ProtectedPage.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/app/hooks/useMe";

export default function ProtectedPage({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) {
      router.push("/login");
    }
  }, [loading, me, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!me) return null; // Redirect will happen

  return <>{children}</>;
}

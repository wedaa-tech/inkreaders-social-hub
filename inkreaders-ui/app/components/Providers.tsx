// app/components/Providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
// ⬇️ default import, not named
import ToastProvider from "./ToastProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}

// app/components/Providers.tsx
"use client";


// ⬇️ default import, not named
import ToastProvider from "./ToastProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
      <ToastProvider>{children}</ToastProvider>
  );
}

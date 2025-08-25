"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; title?: string; message: string; variant?: "success"|"error"|"info" };
type ToastCtx = { push: (t: Omit<Toast,"id">) => void };

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast,"id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, ...t }]);
    // auto-dismiss in 3.2s
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* viewport */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-3 sm:top-4 sm:max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto rounded-xl border px-4 py-3 shadow-sm",
              t.variant === "success" && "border-green-200 bg-green-50 text-green-900",
              t.variant === "error" && "border-red-200 bg-red-50 text-red-900",
              (!t.variant || t.variant === "info") && "border-gray-200 bg-white text-gray-900",
            ].filter(Boolean).join(" ")}
          >
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            <div className="text-sm">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

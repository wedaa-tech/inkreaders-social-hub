// app/login/page.tsx
"use client";

import React from "react";
import { startRedirectLogin } from "@/lib/authClient";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
          <h1 className="text-xl font-semibold">Sign in</h1>

          <button
            onClick={() => startRedirectLogin("google")}
            className="w-full rounded-xl border px-4 py-2"
          >
            Continue with Google
          </button>

          <button
            onClick={() => startRedirectLogin("github")}
            className="w-full rounded-xl border px-4 py-2"
          >
            Continue with GitHub
          </button>

          <p className="text-sm text-gray-500">
            Or use the popup flow from the app (recommended for SPA UX).
          </p>
        </div>
      </div>
    </main>
  );
}

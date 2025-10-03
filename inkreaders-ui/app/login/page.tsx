"use client";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  function handleGoogleLogin() {
    window.location.href = `${API_BASE}/api/auth/oauth/google/start`;
  }
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <button
            onClick={handleGoogleLogin}
            className="w-full rounded-xl border px-4 py-2 bg-red-500 text-white hover:bg-red-600"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}

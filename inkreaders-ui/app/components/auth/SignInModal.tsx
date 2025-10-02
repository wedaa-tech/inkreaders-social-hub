"use client";

import React, { useState } from "react";
import Modal from "../ui/Modal";


const API_BASE =
  (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_BASE)
    ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "")
    : "http://localhost:8080";

type Props = { open: boolean; onClose: () => void };

const PROVIDERS: { id: string; name: string; color?: string }[] = [
  { id: "google", name: "Google", color: "#DB4437" },
  { id: "github", name: "GitHub", color: "#24292f" },
];

export default function SignInModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  async function onLoginSuccess() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        console.log("✅ User after login:", data);
        // Dispatch event so LeftSidebar (and others) can refetch
        window.dispatchEvent(new CustomEvent("ink:auth-changed"));
      } else {
        console.warn("/api/auth/me returned", res.status);
      }
    } catch (err) {
      console.error("onLoginSuccess error:", err);
    } finally {
      setLoading(false);
      onClose();
    }
  }

  function openOAuthPopup(provider: "github" | "google") {
    const width = 600,
      height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    let popup = window.open(
      "about:blank",
      "oauth_popup",
      `width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) return;

    const url = `${API_BASE}/api/auth/oauth/${provider}/start?response=json`;
    try {
      popup.location.href = url;
    } catch {
      popup = window.open(url, "oauth_popup");
    }

    // Accept messages from frontend OR backend origin (helps cover both callback behaviours)
    const frontendOrigin = typeof window !== "undefined" ? window.location.origin : "";
    let backendOrigin = "";
    try {
      backendOrigin = new URL(API_BASE).origin;
    } catch {
      backendOrigin = "http://localhost:8080";
    }

    const listener = (ev: MessageEvent) => {
      // Debug log so you can inspect incoming message in DevTools
      console.log("📩 message from popup:", ev.origin, ev.data);

      const isTrustedOrigin =
        ev.origin === frontendOrigin || ev.origin === backendOrigin;

      if (isTrustedOrigin && ev.data?.type === "oauth-success") {
        console.log("✅ OAuth success message received (trusted origin)");
        try {
          popup?.close();
        } catch {}
        // remove before calling success handler to avoid double-handling
        window.removeEventListener("message", listener);
        onLoginSuccess();
      }
    };

    // add listener
    window.addEventListener("message", listener);
  }

  if (!open) return null;

  return (
    <Modal onClose={onClose}>
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      <div className="space-y-3">
        {PROVIDERS.map((prov) => (
          <div key={prov.id} className="flex gap-2 items-center">
            <button
              onClick={() => openOAuthPopup(prov.id as "github" | "google")}
              className="flex-1 block rounded-lg px-4 py-2 text-center font-medium text-white"
              style={{ backgroundColor: prov.color ?? "var(--color-brand)" }}
            >
              Continue with {prov.name}
            </button>
            <button
              onClick={() => {
                const url = `${API_BASE}/api/auth/oauth/${prov.id}/start`;
                window.location.href = url;
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Redirect
            </button>
          </div>
        ))}
        {loading && <p className="text-sm text-gray-500">Signing in…</p>}
      </div>
    </Modal>
  );
}

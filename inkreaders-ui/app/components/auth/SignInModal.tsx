// app/components/auth/SignInModal.tsx
"use client";

import Modal from "../ui/Modal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function SignInModal({
  open,
  onClose,
  redirectUrl, // 👈 NEW PROP
}: {
  open: boolean;
  onClose: () => void;
  redirectUrl?: string; // 👈 NEW PROP TYPE
}) {
  if (!open) return null;

  function handleGoogleLogin() {
    // Construct the base URL
    let url = `${API_BASE}/api/auth/oauth/google/start`;

    // 💡 NEW LOGIC: Append the redirect URL as a query parameter
    if (redirectUrl) {
      // Encode the redirect URL so it can be safely passed in the query string
      url += `?redirect_to=${encodeURIComponent(redirectUrl)}`;
    }
    
    // Redirect to backend OAuth start endpoint
    window.location.href = url;
  }

  return (
    <Modal onClose={onClose}>
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      <div className="space-y-3">
        <button
          onClick={handleGoogleLogin}
          className="block w-full rounded-lg px-4 py-2 text-center font-medium text-white hover:opacity-90"
          style={{ backgroundColor: "#DB4437" }}
        >
          Continue with Google
        </button>

        <p className="text-sm text-gray-500 text-center">
          By signing in, you agree to our Terms &amp; Privacy.
        </p>
      </div>
    </Modal>
  );
}
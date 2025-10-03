// app/components/auth/SignInModal.tsx
"use client";

import Modal from "../ui/Modal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  function handleGoogleLogin() {
    // Redirect to backend OAuth start endpoint
    window.location.href = `${API_BASE}/api/auth/oauth/google/start`;
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

        {/* Optional: If you want GitHub later, add another button */}
        {/* <button
          onClick={() =>
            (window.location.href = `${API_BASE}/api/auth/oauth/github/start`)
          }
          className="block w-full rounded-lg px-4 py-2 text-center font-medium text-white hover:opacity-90"
          style={{ backgroundColor: "#333" }}
        >
          Continue with GitHub
        </button> */}

        <p className="text-sm text-gray-500 text-center">
          By signing in, you agree to our Terms &amp; Privacy.
        </p>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  signIn,
  getProviders,
  ClientSafeProvider,
} from "next-auth/react";
import Modal from "../ui/Modal";

export default function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [providers, setProviders] = useState<
    Record<string, ClientSafeProvider> | null
  >(null);

  useEffect(() => {
    if (open) {
      getProviders().then((prov) => setProviders(prov));
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal onClose={onClose}>
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      <div className="space-y-3">
        {!providers ? (
          <p className="text-sm text-gray-500 text-center">Loading…</p>
        ) : (
          Object.values(providers).map((prov) => (
            <button
              key={prov.id}
              onClick={() => signIn(prov.id)}
              className="block w-full rounded-lg px-4 py-2 text-center font-medium text-white hover:opacity-90"
              style={{
                backgroundColor:
                  prov.id === "google"
                    ? "#DB4437"
                    : prov.id === "github"
                    ? "#333"
                    : "var(--color-brand)",
              }}
            >
              Continue with {prov.name}
            </button>
          ))
        )}
        <p className="text-sm text-gray-500 text-center">
          By signing in, you agree to our Terms & Privacy.
        </p>
      </div>
    </Modal>
  );
}

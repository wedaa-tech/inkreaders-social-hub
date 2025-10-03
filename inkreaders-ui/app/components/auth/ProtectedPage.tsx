// app/components/auth/ProtectedPage.tsx
"use client";

import { ReactNode } from "react";
import { useMe } from "@/app/hooks/useMe";
import SignInModal from "./SignInModal";
import { usePathname, useSearchParams } from "next/navigation"; // 👈 Import hooks for URL

export default function ProtectedPage({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const pathname = usePathname(); // 👈 Get the current path
  const searchParams = useSearchParams(); // 👈 Get the current query parameters
  
  // Construct the full current URL to pass to the login endpoint
  const currentPath = `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!me) {
    return (
      <>
        <SignInModal
          open={true}
          // Pass the current path as the redirect parameter
          redirectUrl={currentPath} // 👈 NEW PROP
          onClose={() => {
            // Optional: If the user closes the modal, redirect them to the home page.
            window.location.href = "/";
          }}
        />
        <div className="p-8 text-center text-gray-500">
          Please sign in to view this page.
        </div>
      </>
    );
  }

  return <>{children}</>;
}
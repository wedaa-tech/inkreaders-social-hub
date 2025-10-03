// app/login/page.tsx (Updated for redirect support)
"use client";

import { useState } from "react";
import Shell from "@/app/components/centre/Shell";
import SignInModal from "@/app/components/auth/SignInModal";
import { useSearchParams } from "next/navigation"; // 👈 Import useSearchParams

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_to"); // 👈 Check for a redirect parameter
  
  const [open, setOpen] = useState(true);

  return (
    <Shell expandCenter={true}>
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <h1 className="text-2xl font-bold text-gray-800">Welcome Back to InkReaders</h1>
        <p className="mt-2 text-gray-600">Please sign in to continue to the platform.</p>
      </div>

      <SignInModal 
        open={open} 
        redirectUrl={redirectUrl ?? "/"} // 👈 Pass the redirect URL from the query string
        onClose={() => {
          window.location.href = redirectUrl ?? "/"; // Redirect on close
          setOpen(false);
        }} 
      />
    </Shell>
  );
}
"use client";

import { useState } from "react";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setStatus("success");
      setMessage(data.message ?? "Subscribed!");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        name="email"
        required
        placeholder="Your email"
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
      />
      <button
        disabled={status === "loading"}
        className="rounded-lg px-5 py-2 font-medium bg-[color:var(--color-brand)] text-white hover:opacity-90 transition disabled:opacity-50"
      >
        {status === "loading" ? "Submitting..." : "Subscribe"}
      </button>

      {message && (
        <p
          className={
            "text-sm " +
            (status === "success" ? "text-green-600" : status === "error" ? "text-red-600" : "text-gray-600")
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

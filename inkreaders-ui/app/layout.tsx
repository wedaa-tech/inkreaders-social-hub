// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "./components/ToastProvider";


export const metadata: Metadata = {
  title: "Next.js + Tailwind v4",
  description: "App Router setup",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

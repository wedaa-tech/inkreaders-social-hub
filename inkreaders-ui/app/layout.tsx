// app/layout.tsx
import "./globals.css";
import Providers from "./components/Providers";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-tamil/400.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

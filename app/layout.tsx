import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TTS Deals für Creator", template: "%s | TTS Deals" },
  description:
    "Für TikTok Shop Creator: Samples per Telegram hochladen, drei Preisvorschläge bekommen und sehen, was nach Steuer zurückkommt.",
  icons: { icon: "/img/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-ink-950 text-fg">{children}</body>
    </html>
  );
}

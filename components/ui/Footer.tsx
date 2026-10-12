import Link from "next/link";
import { Logo } from "./Logo";
import { telegramBotLinkStatic } from "@/lib/links";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">
            Für TikTok Shop Creator: Samples per Telegram hochladen und mit fairem Preis weiterverkaufen.
          </p>
        </div>
        <nav aria-label="Creator" className="text-sm">
          <p className="font-medium text-fg">Creator</p>
          <ul className="mt-4 space-y-3 text-fg-muted">
            <li><Link href="/registrieren" className="hover:text-fg">Registrieren</Link></li>
            <li><Link href="/dashboard" className="hover:text-fg">Login</Link></li>
            <li><a href={telegramBotLinkStatic} target="_blank" rel="noopener noreferrer" className="hover:text-fg">Telegram-Bot</a></li>
          </ul>
        </nav>
        <nav aria-label="Info" className="text-sm">
          <p className="font-medium text-fg">Info</p>
          <ul className="mt-4 space-y-3 text-fg-muted">
            <li><Link href="/#ablauf" className="hover:text-fg">So läuft&apos;s</Link></li>
            <li><Link href="/#rechner" className="hover:text-fg">Preisrechner</Link></li>
            <li><Link href="/#faq" className="hover:text-fg">FAQ</Link></li>
            <li><Link href="/marketplace" className="hover:text-fg">Marketplace</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-10 text-xs text-fg-subtle sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span>© 2026 TTS Deals</span>
        <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="hover:text-fg-muted">Fotos: Unsplash</a>
      </div>
    </footer>
  );
}

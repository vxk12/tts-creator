"use client";

import { useState } from "react";
import { Eye, EyeSlash, SignOut, TelegramLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { telegramBotLink } from "@/lib/api";
import { fmtPct } from "@/lib/pricing";
import { useDashboard } from "./DashboardShell";
import { PageHead } from "./ui";

export function AccountView() {
  const { creds, creator, logout } = useDashboard();
  const [show, setShow] = useState(false);

  return (
    <div>
      <PageHead title="Konto" text="Dein Zugang für Bot und Dashboard." />

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="tg-title" className="flex flex-col rounded-card bg-neon p-6 text-neon-ink sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id="tg-title" className="text-2xl font-semibold tracking-tight">Telegram verbinden</h2>
            <TelegramLogo size={32} weight="fill" aria-hidden="true" />
          </div>
          <p className="mt-3 max-w-[48ch] leading-relaxed text-neon-ink/80">
            Hochgeladen wird über den Bot. Dort meldest du dich einmalig mit Username und Creator-Key an.
          </p>
          <a
            href={telegramBotLink(creds.userId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-neon-ink px-6 text-[15px] font-medium text-neon transition-transform active:scale-[0.98]"
          >
            <TelegramLogo size={18} weight="fill" /> Mit Telegram verbinden
          </a>
        </section>

        <section aria-labelledby="acc-title" className="rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
          <h2 id="acc-title" className="text-2xl font-semibold tracking-tight">Zugangsdaten</h2>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-fg-muted">Creator-ID</dt>
              <dd className="mt-1 text-base font-medium">@{creator.userId}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Steuersatz</dt>
              <dd className="mt-1 text-base font-medium tabular">{fmtPct(creator.statusCode)}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-xl bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-fg-muted">Dein Creator-Key</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="mr-auto break-all font-mono text-sm">{show ? creds.creatorKey : "••••••••••••••••"}</code>
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-xs font-medium hover:border-white/35"
              >
                {show ? <EyeSlash size={14} /> : <Eye size={14} />} {show ? "Verbergen" : "Anzeigen"}
              </button>
              <CopyButton text={creds.creatorKey} />
            </div>
          </div>
          <Button type="button" variant="secondary" className="mt-6" onClick={logout}>
            <SignOut size={16} /> Abmelden
          </Button>
        </section>
      </div>
    </div>
  );
}

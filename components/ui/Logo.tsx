import Link from "next/link";

/** Wortmarke: einfaches geometrisches Zeichen (Play-Fläche) + Schriftzug. */
export function Logo({ suffix }: { suffix?: string }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5 rounded-full" aria-label="TTS Deals Startseite">
      <span className="grid size-7 place-items-center rounded-lg bg-neon text-neon-ink transition-transform duration-300 ease-out-expo group-hover:rotate-[-6deg]">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        </svg>
      </span>
      <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight">
        TTS Deals{suffix ? <span className="ml-1.5 hidden font-normal text-fg-muted sm:inline">{suffix}</span> : null}
      </span>
    </Link>
  );
}

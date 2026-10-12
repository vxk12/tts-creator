"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List, ShoppingBag, VideoCamera, X } from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { ButtonLink } from "./Button";
import { DEMO } from "@/lib/config";

const LINKS = [
  { href: "/#ablauf", label: "So läuft's" },
  { href: "/#rechner", label: "Preisrechner" },
  { href: "/#faq", label: "FAQ" },
];

const AREAS = [
  { href: "/", label: "Creator", icon: VideoCamera },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
] as const;

/** Umschalter zwischen den beiden Bereichen der Website. */
function AreaSwitch() {
  const market = usePathname().startsWith("/marketplace");
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Bereich" className="flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
      {AREAS.map((a) => {
        const active = (a.href === "/marketplace") === market;
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={active ? "page" : undefined}
            aria-label={a.label}
            className={`relative inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-200 ${
              active ? "text-neon-ink" : "text-fg-muted hover:text-fg"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="area"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-neon"
              />
            ) : null}
            <a.icon size={16} weight={active ? "fill" : "regular"} className="relative" aria-hidden="true" />
            <span className="relative hidden sm:inline">{a.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const market = usePathname().startsWith("/marketplace");
  const links = market ? [] : LINKS;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_auto_1fr] items-center gap-3 px-4 sm:grid-cols-[1fr_auto_1fr] sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo compact />
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-7 text-sm text-fg-muted xl:flex">
            {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <AreaSwitch />

        <div className="flex items-center justify-end gap-2">
          {DEMO ? (
            <span className="mr-2 hidden rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-subtle lg:inline">
              Demo-Modus
            </span>
          ) : null}
          <Link href="/dashboard" className="hidden h-10 items-center rounded-full px-4 text-sm text-fg-muted transition-colors hover:text-fg lg:inline-flex">
            Login
          </Link>
          <ButtonLink href="/registrieren">Registrieren</ButtonLink>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-fg-muted hover:text-fg xl:hidden"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-white/[0.06] bg-ink-950 xl:hidden"
          >
            <nav aria-label="Mobile Navigation" className="flex flex-col px-4 py-4">
              {[...links, { href: "/dashboard", label: "Login" }].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-2 py-3 text-lg text-fg">
                  {l.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List, X } from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { ButtonLink } from "./Button";
import { DEMO } from "@/lib/config";

const LINKS = [
  { href: "/#ablauf", label: "So läuft's" },
  { href: "/#rechner", label: "Preisrechner" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo suffix="Creator" />

        <nav aria-label="Hauptnavigation" className="ml-6 hidden items-center gap-7 text-sm text-fg-muted md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {DEMO ? (
            <span className="mr-2 hidden rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-subtle lg:inline">
              Demo-Modus
            </span>
          ) : null}
          <Link href="/dashboard" className="hidden h-10 items-center rounded-full px-4 text-sm text-fg-muted transition-colors hover:text-fg sm:inline-flex">
            Login
          </Link>
          <ButtonLink href="/registrieren">Registrieren</ButtonLink>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-fg-muted hover:text-fg md:hidden"
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
            className="border-t border-white/[0.06] bg-ink-950 md:hidden"
          >
            <nav aria-label="Mobile Navigation" className="flex flex-col px-4 py-4">
              {[...LINKS, { href: "/dashboard", label: "Login" }].map((l) => (
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

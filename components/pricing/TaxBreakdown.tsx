"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TIERS, fmtEUR, fmtPct, offer, type TierId } from "@/lib/pricing";
import { AnimatedEuro } from "./AnimatedEuro";

/**
 * Beispielrechnung für ein Sample: Wohin gehen die Euro des Einkaufspreises?
 * Balken = Einkaufspreis. Neon = was zurückkommt (Verkaufspreis + Steuervorteil), grau = der Rest.
 */
export function TaxBreakdown({ rate, purchase = 27 }: { rate: number; purchase?: number }) {
  const reduce = useReducedMotion();
  const [tierId, setTierId] = useState<TierId>("fair");
  const o = offer(purchase, tierId, rate);
  const transition = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 140, damping: 22 } as const);

  return (
    <div className="rounded-card border border-white/[0.08] bg-ink-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-fg">So rechnen wir</p>
        <p className="text-sm text-fg-subtle tabular">Beispiel: Sample für {fmtEUR(o.purchase)}</p>
      </div>

      <div role="radiogroup" aria-label="Preisstufe im Beispiel" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-white/[0.04] p-1">
        {TIERS.map((t) => {
          const active = t.id === tierId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTierId(t.id)}
              className={`relative h-9 rounded-full text-sm font-medium transition-colors duration-200 ${active ? "text-neon-ink" : "text-fg-muted hover:text-fg"}`}
            >
              {active ? <motion.span layoutId="tax-tier" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }} className="absolute inset-0 rounded-full bg-neon" /> : null}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Gespiegelt (Rest links, Verkaufspreis rechts): von Fair zu Sofort weg wandern die Grenzen nach rechts.
          Ebenen von unten: Rest (Hintergrund), Steuervorteil, Verkaufspreis. Nur transform wird animiert. */}
      <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
        <motion.div
          className="absolute inset-0 origin-right bg-neon-deep"
          initial={false}
          animate={{ scaleX: (o.price + o.taxSaving) / o.purchase }}
          transition={transition}
        />
        <motion.div className="absolute inset-0 origin-right bg-neon" initial={false} animate={{ scaleX: o.price / o.purchase }} transition={transition} />
      </div>

      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm" aria-live="polite">
        <dt className="text-fg-muted">Einkaufspreis</dt>
        <dd className="text-right tabular">{fmtEUR(o.purchase)}</dd>
        <dt className="flex items-center gap-2.5 text-fg-muted">
          <span className="size-2.5 rounded-sm bg-neon" aria-hidden="true" />
          Verkaufspreis {o.tier.label} ({Math.round(o.tier.factor * 100)} %)
        </dt>
        <dd className="text-right tabular"><AnimatedEuro value={o.price} /></dd>
        <dt className="flex items-center gap-2.5 text-fg-muted">
          <span className="size-2.5 rounded-sm bg-neon-deep" aria-hidden="true" />
          Steuervorteil ({fmtPct(rate)} von {fmtEUR(o.diff)})
        </dt>
        <dd className="text-right tabular">+ <AnimatedEuro value={o.taxSaving} /></dd>
      </dl>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.08] pt-5">
        <span className="text-sm font-medium text-fg">
          Du bekommst zurück
          <span className="mt-0.5 block text-xs font-normal text-fg-muted tabular">{Math.round(o.backShare * 100)} % von {fmtEUR(o.purchase)}</span>
        </span>
        <AnimatedEuro value={o.back} className="text-3xl font-semibold tracking-tight text-neon" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        Verkaufspreis plus Steuervorteil. Ein Verkauf unter Einkaufspreis mindert deine Steuer um (Einkaufspreis minus Verkaufspreis) × Steuersatz. Schätzung, keine Steuerberatung.
      </p>
    </div>
  );
}

"use client";

import { useLayoutEffect, useState } from "react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { TIERS, fmtEUR, fmtPct, offer, type TierId } from "@/lib/pricing";
import { AnimatedEuro } from "./AnimatedEuro";

/**
 * Beispielrechnung für ein Sample: Wohin gehen die Euro des Einkaufspreises?
 * Balken = Einkaufspreis, aufgeteilt in Verkaufspreis, Steuervorteil und echten Verlust.
 */
export function TaxBreakdown({ rate, purchase = 27 }: { rate: number; purchase?: number }) {
  const reduce = useReducedMotion();
  const [tierId, setTierId] = useState<TierId>("fair");
  const o = offer(purchase, tierId, rate);
  const [bar, animateBar] = useAnimate<HTMLDivElement>();

  // Bei jeder neuen Rechnung füllt sich der Balken von links nach rechts.
  // Imperativ, weil AnimatePresence initial={false} (Onboarding) deklarative Start-Animationen unterdrückt.
  // Layout-Effekt + Startwert setzen, damit der Balken nicht einen Frame lang voll aufblitzt.
  useLayoutEffect(() => {
    if (reduce || !bar.current) return;
    bar.current.style.transform = "scaleX(0)";
    animateBar(bar.current, { scaleX: [0, 1] }, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
  }, [tierId, rate, reduce, bar, animateBar]);

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

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <div ref={bar} className="flex h-full origin-left">
          <span className="bg-ink-700" style={{ width: `${(o.price / o.purchase) * 100}%` }} />
          <span className="bg-neon-deep" style={{ width: `${(o.taxSaving / o.purchase) * 100}%` }} />
          <span className="flex-1 bg-neon" />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm" aria-live="polite">
        <dt className="text-fg-muted">Einkaufspreis</dt>
        <dd className="text-right tabular">{fmtEUR(o.purchase)}</dd>
        <dt className="flex items-center gap-2.5 text-fg-muted">
          <span className="size-2.5 rounded-sm bg-ink-700 ring-1 ring-white/20" aria-hidden="true" />
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
        <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
          <span className="size-2.5 rounded-sm bg-neon" aria-hidden="true" />
          Echter Verlust nach Steuer
        </span>
        <AnimatedEuro value={o.loss} className="text-3xl font-semibold tracking-tight text-neon" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        (Einkaufspreis minus Verkaufspreis) × (1 minus Steuersatz). Ein Verkauf unter Einkaufspreis mindert deine Steuer. Schätzung, keine Steuerberatung.
      </p>
    </div>
  );
}

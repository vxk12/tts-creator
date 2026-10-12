"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import { TIERS, chosenPrice, fmtEUR, fmtPct, priceOffer, type PriceChoice } from "@/lib/pricing";
import { AnimatedEuro } from "./AnimatedEuro";

/**
 * Beispielrechnung, bewusst einfach: Geld kommt aus zwei Quellen.
 * Sofort vom Käufer (Verkaufspreis) und später über die Steuer (Steuervorteil). Formel nur auf Klick.
 */
export function TaxBreakdown({ rate, purchase = 27 }: { rate: number; purchase?: number }) {
  const reduce = useReducedMotion();
  const [choice, setChoice] = useState<PriceChoice>("fair");
  const [customText, setCustomText] = useState("20,00");
  const price = chosenPrice(purchase, choice, customText);
  const o = priceOffer(purchase, price ?? 0, rate);
  const valid = price != null;
  const transition = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 140, damping: 22 } as const);
  const hasTax = valid && o.taxSaving > 0;
  const options = [...TIERS.map((t) => ({ id: t.id as PriceChoice, label: t.label })), { id: "eigen" as PriceChoice, label: "Eigener" }];

  return (
    <div className="rounded-card border border-white/[0.08] bg-ink-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-fg">So rechnen wir</p>
        <p className="text-sm text-fg-subtle tabular">Beispiel: Sample für {fmtEUR(o.purchase)}</p>
      </div>

      <div role="radiogroup" aria-label="Preis im Beispiel" className="mt-4 grid grid-cols-4 gap-1 rounded-full bg-white/[0.04] p-1">
        {options.map((t) => {
          const active = t.id === choice;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(t.id)}
              className={`relative h-9 rounded-full text-[13px] font-medium sm:text-sm transition-colors duration-200 ${active ? "text-neon-ink" : "text-fg-muted hover:text-fg"}`}
            >
              {active ? <motion.span layoutId="tax-tier" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }} className="absolute inset-0 rounded-full bg-neon" /> : null}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>

      {choice === "eigen" ? (
        <label className="mt-3 flex items-center justify-between gap-3 text-sm text-fg-muted">
          Dein Verkaufspreis
          <span className="flex items-center gap-1.5">
            <input
              inputMode="decimal"
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              aria-invalid={!valid}
              className="w-24 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-right font-semibold text-fg tabular outline-none focus:border-neon aria-[invalid=true]:border-danger"
            />
            €
          </span>
        </label>
      ) : null}

      {/* Gespiegelt (Rest links, Verkaufspreis rechts): von Fair zu Sofort weg wandern die Grenzen nach rechts.
          Ebenen von unten: Rest (Hintergrund), Steuer, Verkaufspreis. Nur transform wird animiert. */}
      <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
        <motion.div className="absolute inset-0 origin-right bg-neon-deep" initial={false} animate={{ scaleX: valid ? Math.min(1, o.back / o.purchase) : 0 }} transition={transition} />
        <motion.div className="absolute inset-0 origin-right bg-neon" initial={false} animate={{ scaleX: valid ? Math.min(1, o.price / o.purchase) : 0 }} transition={transition} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4" aria-live="polite">
        <span className="text-sm font-medium text-fg">{hasTax ? "Du bekommst bis zu" : "Du bekommst"}</span>
        <AnimatedEuro value={valid ? o.back : null} className="text-3xl font-semibold tracking-tight text-neon" />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 border-t border-white/[0.08] pt-4 text-sm">
        <dd className="text-right font-medium tabular"><AnimatedEuro value={valid ? o.price : null} /></dd>
        <dt className="flex items-center gap-2 text-fg-muted">
          <span className="size-2.5 rounded-sm bg-neon" aria-hidden="true" /> sofort vom Käufer
        </dt>
        <dd className="text-right font-medium tabular">+ <AnimatedEuro value={valid ? o.taxSaving : null} /></dd>
        <dt className="flex items-center gap-2 text-fg-muted">
          <span className="size-2.5 rounded-sm bg-neon-deep" aria-hidden="true" /> später mit deiner Steuererklärung
        </dt>
      </dl>
      <p className="mt-4 text-sm text-fg-muted">
        {!valid
          ? "Gib deinen Preis ein, z. B. 19,90."
          : hasTax
            ? `Ohne Steuererklärung bleibt es bei ${fmtEUR(o.price)}.`
            : o.diff <= 0
              ? "Über Einkaufspreis gibt es keinen Steuervorteil."
              : "Bei 0 % Steuersatz kommt über die Steuer nichts dazu."}
      </p>

      {hasTax ? (
      <details className="group mt-3 text-xs text-fg-subtle">
        <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-fg-muted">
          Wie rechnen wir das? <CaretDown size={12} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="mt-2 leading-relaxed">
          Du verkaufst {fmtEUR(o.diff)} unter Einkaufspreis. Das senkt dein zu versteuerndes Einkommen, bei {fmtPct(rate)} Steuersatz zahlst du dadurch{" "}
          {fmtEUR(o.taxSaving)} weniger Steuern. Schätzung, keine Steuerberatung.
        </p>
      </details>
      ) : null}
    </div>
  );
}

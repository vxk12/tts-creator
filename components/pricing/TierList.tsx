"use client";

import { CUSTOM_LABEL, TIERS, fmtEUR, offer, parseMoney, taxBack, tierPrice, type PriceChoice } from "@/lib/pricing";

/**
 * Drei Preisvorschläge als Auswahl-Zeilen, optional plus „Eigener Preis“ mit Eingabefeld.
 * Mit Steuersatz zusätzlich, was später über die Steuer kommt.
 */
export function TierList({
  purchase,
  rate,
  value,
  onChange,
  name = "tier",
  custom,
}: {
  purchase: number | null;
  rate: number | null;
  value: PriceChoice;
  onChange: (id: PriceChoice) => void;
  name?: string;
  /** Eingabe für den eigenen Preis; ohne diese Prop gibt es nur die Vorschläge */
  custom?: { text: string; onText: (v: string) => void };
}) {
  const customPrice = custom ? parseMoney(custom.text) : NaN;
  const customExtra = purchase != null && rate != null && customPrice > 0 ? taxBack(purchase, customPrice, rate) : 0;
  const customSelected = value === "eigen";
  return (
    <div role="radiogroup" aria-label="Preisstufe" className="grid gap-2">
      {TIERS.map((t) => {
        const price = purchase != null ? tierPrice(purchase, t.id) : null;
        const o = purchase != null && rate != null ? offer(purchase, t.id, rate) : null;
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            onClick={() => onChange(t.id)}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors duration-200 active:scale-[0.99] sm:px-5 ${
              selected ? "border-neon/70 bg-neon/[0.07]" : "border-white/[0.08] hover:border-white/25"
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-5 place-items-center rounded-full border ${selected ? "border-neon" : "border-white/30"}`}
            >
              <span className={`size-2.5 rounded-full bg-neon transition-transform duration-200 ${selected ? "scale-100" : "scale-0"}`} />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className={`font-medium ${selected ? "text-neon" : "text-fg"}`}>{t.label}</span>
                <span className="text-xs text-fg-subtle tabular">{Math.round(t.factor * 100)} %</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-fg-muted">{t.hint}</span>
            </span>
            <span className="text-right">
              <span className={`block text-xl font-semibold tracking-tight tabular sm:text-2xl ${selected ? "text-fg" : "text-fg/90"}`}>
                {price != null ? fmtEUR(price) : "-"}
              </span>
              <span className="block text-xs text-fg-muted tabular">{o && o.taxSaving > 0 ? `+ ${fmtEUR(o.taxSaving)} über Steuer` : " "}</span>
            </span>
          </button>
        );
      })}
      {custom ? (
        <div
          onClick={() => onChange("eigen")}
          className={`grid cursor-text grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border px-4 py-3 transition-colors duration-200 sm:px-5 ${
            customSelected ? "border-neon/70 bg-neon/[0.07]" : "border-white/[0.08] hover:border-white/25"
          }`}
        >
          <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border ${customSelected ? "border-neon" : "border-white/30"}`}>
            <span className={`size-2.5 rounded-full bg-neon transition-transform duration-200 ${customSelected ? "scale-100" : "scale-0"}`} />
          </span>
          <span className="min-w-0">
            <span className={`block font-medium ${customSelected ? "text-neon" : "text-fg"}`}>{CUSTOM_LABEL}</span>
            <span className="mt-0.5 block truncate text-xs text-fg-muted">Du legst den Preis selbst fest</span>
          </span>
          <span className="text-right">
            <span className="flex items-center justify-end gap-1">
              <input
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Eigener Verkaufspreis in Euro"
                value={custom.text}
                onFocus={() => onChange("eigen")}
                onChange={(e) => { custom.onText(e.target.value); onChange("eigen"); }}
                aria-invalid={custom.text.trim() !== "" && !(customPrice > 0)}
                className="w-24 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-right text-lg font-semibold tabular outline-none focus:border-neon aria-[invalid=true]:border-danger"
              />
              <span className="text-fg-subtle">€</span>
            </span>
            <span className="mt-0.5 block text-xs text-fg-muted tabular">{customExtra > 0 ? `+ ${fmtEUR(customExtra)} über Steuer` : "\u00a0"}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

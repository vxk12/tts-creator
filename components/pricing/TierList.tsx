"use client";

import { TIERS, fmtEUR, offer, type TierId } from "@/lib/pricing";

/** Drei Preisstufen als Auswahl-Zeilen mit Preis und dem, was nach Steuer zurückkommt. */
export function TierList({
  purchase,
  rate,
  value,
  onChange,
  name = "tier",
}: {
  purchase: number | null;
  rate: number | null;
  value: TierId;
  onChange: (id: TierId) => void;
  name?: string;
}) {
  const ready = purchase != null && rate != null;
  return (
    <div role="radiogroup" aria-label="Preisstufe" className="grid gap-2">
      {TIERS.map((t) => {
        const o = ready ? offer(purchase, t.id, rate) : null;
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
                {o ? fmtEUR(o.price) : "-"}
              </span>
              <span className="block text-xs text-fg-muted tabular">{o ? `Zurück ${fmtEUR(o.back)}` : " "}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

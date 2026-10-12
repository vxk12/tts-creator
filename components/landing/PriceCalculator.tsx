"use client";

import { useMemo, useState } from "react";
import { BRACKETS, MAX_RATE_PERCENT, fmtEUR, fmtPct, offer, parseMoney, parseRatePercent, type TierId } from "@/lib/pricing";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { TierList } from "@/components/pricing/TierList";
import { AnimatedEuro } from "@/components/pricing/AnimatedEuro";

type RateMode = { kind: "preset"; code: number } | { kind: "custom" };

export function PriceCalculator() {
  const [priceText, setPriceText] = useState("27,00");
  const [mode, setMode] = useState<RateMode>({ kind: "preset", code: 0.3 });
  const [customPct, setCustomPct] = useState("35");
  const [tierId, setTierId] = useState<TierId>("fair");

  const purchaseRaw = parseMoney(priceText);
  const purchase = Number.isFinite(purchaseRaw) && purchaseRaw > 0 && purchaseRaw <= 100000 ? purchaseRaw : null;
  const rate = mode.kind === "preset" ? mode.code : parseRatePercent(customPct);
  const selected = useMemo(() => (purchase != null && rate != null ? offer(purchase, tierId, rate) : null), [purchase, rate, tierId]);
  const priceInvalid = priceText.trim() !== "" && purchase == null;
  const customInvalid = mode.kind === "custom" && customPct.trim() !== "" && rate == null;

  const chip = (active: boolean) =>
    `h-10 rounded-full border px-4 text-sm font-medium transition-colors duration-200 active:scale-[0.98] ${
      active ? "border-neon bg-neon text-neon-ink" : "border-white/12 text-fg hover:border-white/35"
    }`;

  return (
    <section id="rechner" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <Reveal className="max-w-2xl">
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Extra: mehr rausholen mit der Steuer</h2>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-fg-muted">
          Optional. Verkaufst du unter Einkaufspreis, zahlst du weniger Steuern. Hier siehst du, was später mit der Steuererklärung dazukommt.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal>
          <div className="h-full rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
            <label htmlFor="calc-price" className="text-sm font-medium text-fg">
              Einkaufspreis
            </label>
            <div className={`mt-3 flex items-baseline gap-2 border-b pb-2 transition-colors focus-within:border-neon ${priceInvalid ? "border-danger" : "border-white/15"}`}>
              <input
                id="calc-price"
                inputMode="decimal"
                autoComplete="off"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                onBlur={() => purchase != null && setPriceText(purchase.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                aria-invalid={priceInvalid}
                aria-describedby="calc-price-help"
                className="w-0 flex-1 bg-transparent text-5xl font-semibold tracking-tight text-fg tabular outline-none sm:text-6xl"
              />
              <span className="text-3xl text-fg-subtle">€</span>
            </div>
            <p id="calc-price-help" className={`mt-2 text-xs ${priceInvalid ? "text-danger" : "text-fg-subtle"}`}>
              {priceInvalid ? "Bitte nur eine Zahl eingeben, z. B. 27,90" : "Was du für das Sample bezahlt hast."}
            </p>

            <fieldset className="mt-10">
              <legend className="text-sm font-medium text-fg">Dein Steuersatz</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {BRACKETS.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    aria-pressed={mode.kind === "preset" && mode.code === b.code}
                    className={chip(mode.kind === "preset" && mode.code === b.code)}
                    onClick={() => setMode({ kind: "preset", code: b.code })}
                  >
                    {fmtPct(b.code)}
                  </button>
                ))}
                <button type="button" aria-pressed={mode.kind === "custom"} className={chip(mode.kind === "custom")} onClick={() => setMode({ kind: "custom" })}>
                  Eigener Wert
                </button>
              </div>
              {mode.kind === "custom" ? (
                <div className="mt-5">
                  <label htmlFor="calc-pct" className="text-sm text-fg-muted">
                    Grenzsteuersatz in %
                  </label>
                  <div className={`mt-1 flex max-w-[10rem] items-baseline gap-2 border-b pb-1 focus-within:border-neon ${customInvalid ? "border-danger" : "border-white/15"}`}>
                    <input
                      id="calc-pct"
                      inputMode="decimal"
                      autoComplete="off"
                      value={customPct}
                      onChange={(e) => setCustomPct(e.target.value)}
                      aria-invalid={customInvalid}
                      className="w-0 flex-1 bg-transparent text-3xl font-semibold text-fg tabular outline-none"
                    />
                    <span className="text-xl text-fg-subtle">%</span>
                  </div>
                  {customInvalid ? <p className="mt-2 text-xs text-danger">Bitte einen Wert zwischen 0 und {MAX_RATE_PERCENT} eingeben.</p> : null}
                </div>
              ) : null}
              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                0 %, 30 % und 42 % entsprechen den Einkommensstufen aus der Registrierung.
              </p>
            </fieldset>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="h-full rounded-card border border-white/[0.07] bg-ink-900 p-3 sm:p-4">
            <TierList purchase={purchase} rate={rate} value={tierId} onChange={(id) => id !== "eigen" && setTierId(id)} name="calc-tier" />

            <div className="px-3 pb-3 pt-7 sm:px-4" aria-live="polite">
              <p className="text-sm text-fg-muted">
                Stufe <span className="font-medium text-fg">{selected?.tier.label ?? "-"}</span>
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-sm font-medium text-fg">{selected && selected.taxSaving > 0 ? "Du bekommst bis zu" : "Du bekommst"}</span>
                <AnimatedEuro value={selected?.back ?? null} className="text-3xl font-semibold tracking-tight text-neon sm:text-4xl" />
              </div>
              <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 border-t border-white/[0.08] pt-4 text-sm">
                <dd className="text-right font-medium tabular"><AnimatedEuro value={selected?.price ?? null} /></dd>
                <dt className="text-fg-muted">sofort vom Käufer</dt>
                <dd className="text-right font-medium tabular">+ <AnimatedEuro value={selected?.taxSaving ?? null} /></dd>
                <dt className="text-fg-muted">später mit deiner Steuererklärung{rate != null ? ` (${fmtPct(rate)})` : ""}</dt>
              </dl>
              <p className="mt-4 text-sm text-fg-muted">
                {selected && selected.taxSaving > 0 ? `Ohne Steuererklärung bleibt es bei ${fmtEUR(selected.price)}.` : "Bei 0 % Steuersatz kommt über die Steuer nichts dazu."}
              </p>
              <p className="mt-2 text-xs text-fg-subtle">Schätzung, keine Steuerberatung.</p>
              <ButtonLink href="/registrieren" className="mt-6">
                Registrieren
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

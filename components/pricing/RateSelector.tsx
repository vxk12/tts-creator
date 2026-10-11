"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BRACKETS, MAX_RATE_PERCENT, fmtPct, parseRatePercent } from "@/lib/pricing";

export interface RateState {
  knows: boolean | null; // „Kennst du deinen exakten Grenzsteuersatz?“
  percent: string; // Eingabe in % (bei JA)
  bracket: number | null; // gewählter Status_Code (bei NEIN)
}

export const emptyRate: RateState = { knows: null, percent: "", bracket: null };

export function rateFromState(s: RateState): number | null {
  if (s.knows === true) return parseRatePercent(s.percent);
  if (s.knows === false) return s.bracket;
  return null;
}

export function rateError(s: RateState): string {
  if (s.knows === null) return "Bitte wähle JA oder NEIN.";
  if (s.knows && parseRatePercent(s.percent) === null) return `Bitte gib deinen Grenzsteuersatz in Prozent ein (0 bis ${MAX_RATE_PERCENT}).`;
  if (!s.knows && s.bracket === null) return "Bitte wähle dein geschätztes Gesamteinkommen.";
  return "";
}

/** Vorbelegung aus einem gespeicherten Status_Code */
export function stateFromRate(rate: number): RateState {
  return BRACKETS.some((b) => b.code === rate)
    ? { knows: false, percent: "", bracket: rate }
    : { knows: true, percent: String(Math.round(rate * 10000) / 100).replace(".", ","), bracket: null };
}

const choice = (active: boolean) =>
  `h-14 rounded-xl border text-base font-medium transition-colors duration-200 active:scale-[0.99] ${
    active ? "border-neon/70 bg-neon/[0.07] text-neon" : "border-white/10 text-fg hover:border-white/30"
  }`;

/**
 * Steuer-Abfrage aus dem Onboarding:
 * JA → Eingabe in % (gespeichert als Dezimalzahl, 35 → 0.35) · NEIN → drei Einkommens-Stufen.
 */
export function RateSelector({
  value,
  onChange,
  idPrefix = "rate",
  showQuestion = true,
}: {
  value: RateState;
  onChange: (s: RateState) => void;
  idPrefix?: string;
  showQuestion?: boolean;
}) {
  const reduce = useReducedMotion();
  const invalid = value.knows === true && value.percent.trim() !== "" && parseRatePercent(value.percent) === null;
  const anim = reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

  return (
    <div>
      {showQuestion ? (
        <p id={`${idPrefix}-q`} className="text-base font-medium text-fg">
          Kennst du deinen exakten Grenzsteuersatz?
        </p>
      ) : null}
      <div role="group" aria-label="Kennst du deinen exakten Grenzsteuersatz?" className={`grid grid-cols-2 gap-2 ${showQuestion ? "mt-3" : ""}`}>
        <button type="button" aria-pressed={value.knows === true} className={choice(value.knows === true)} onClick={() => onChange({ ...value, knows: true })}>
          JA
        </button>
        <button type="button" aria-pressed={value.knows === false} className={choice(value.knows === false)} onClick={() => onChange({ ...value, knows: false })}>
          NEIN
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {value.knows === true ? (
          <motion.div key="exact" {...anim} transition={{ duration: 0.25 }} className="mt-6">
            <label htmlFor={`${idPrefix}-pct`} className="text-sm font-medium text-fg">
              Dein Grenzsteuersatz
            </label>
            <div className={`mt-2 flex max-w-[14rem] items-baseline gap-2 border-b pb-1 transition-colors focus-within:border-neon ${invalid ? "border-danger" : "border-white/20"}`}>
              <input
                id={`${idPrefix}-pct`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="z. B. 35"
                value={value.percent}
                onChange={(e) => onChange({ ...value, percent: e.target.value })}
                aria-invalid={invalid}
                aria-describedby={`${idPrefix}-pct-help`}
                className="w-0 flex-1 bg-transparent text-4xl font-semibold tracking-tight text-fg tabular outline-none placeholder:text-fg-subtle/60"
              />
              <span className="text-2xl text-fg-subtle">%</span>
            </div>
            <p id={`${idPrefix}-pct-help`} className={`mt-2 text-xs ${invalid ? "text-danger" : "text-fg-subtle"}`}>
              {invalid ? `Bitte einen Wert zwischen 0 und ${MAX_RATE_PERCENT} eingeben.` : "In Prozent. Gespeichert wird die Dezimalzahl (35 % → 0.35)."}
            </p>
          </motion.div>
        ) : value.knows === false ? (
          <motion.fieldset key="brackets" {...anim} transition={{ duration: 0.25 }} className="mt-6">
            <legend className="text-sm font-medium text-fg">Geschätztes Gesamteinkommen</legend>
            <div className="mt-2 grid gap-2">
              {BRACKETS.map((b) => {
                const active = value.bracket === b.code;
                return (
                  <button
                    key={b.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, bracket: b.code })}
                    className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors duration-200 active:scale-[0.99] ${
                      active ? "border-neon/70 bg-neon/[0.07] text-neon" : "border-white/10 text-fg hover:border-white/30"
                    }`}
                  >
                    <span className="font-medium">{b.label}</span>
                    <span className={`shrink-0 text-xs tabular ${active ? "text-neon" : "text-fg-subtle"}`}>ca. {fmtPct(b.code)}</span>
                  </button>
                );
              })}
            </div>
          </motion.fieldset>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

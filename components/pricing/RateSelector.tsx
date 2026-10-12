"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calculator, Percent } from "@phosphor-icons/react";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
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
  if (s.knows === null) return "Bitte wähle Ja oder Nein.";
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

/**
 * Steuer-Abfrage aus dem Onboarding:
 * Ja → Eingabe in % (gespeichert als Dezimalzahl, 35 → 0.35) · Nein → drei Einkommens-Stufen.
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
      <div role="group" aria-label="Kennst du deinen exakten Grenzsteuersatz?" className={`grid gap-2 sm:grid-cols-2 ${showQuestion ? "mt-3" : ""}`}>
        <ChoiceTile active={value.knows === true} onClick={() => onChange({ ...value, knows: true })} icon={Percent} title="Ja, ich kenne ihn" text="Exakten Satz eingeben" />
        <ChoiceTile active={value.knows === false} onClick={() => onChange({ ...value, knows: false })} icon={Calculator} title="Nein, schätzen" text="Über dein Einkommen" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {value.knows === true ? (
          <motion.div key="exact" {...anim} transition={{ duration: 0.25 }} className="mt-6">
            <label htmlFor={`${idPrefix}-pct`} className="text-sm font-medium text-fg">
              Dein Grenzsteuersatz
            </label>
            <div className={`mt-2 flex h-16 max-w-[16rem] items-center gap-2 rounded-xl border bg-ink-900 px-4 transition-colors focus-within:border-neon ${invalid ? "border-danger" : "border-white/[0.12]"}`}>
              <input
                id={`${idPrefix}-pct`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="z. B. 35"
                value={value.percent}
                onChange={(e) => onChange({ ...value, percent: e.target.value })}
                aria-invalid={invalid}
                aria-describedby={`${idPrefix}-pct-help`}
                className="w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight text-fg tabular outline-none placeholder:text-fg-subtle/60"
              />
              <span className="text-2xl text-fg-subtle">%</span>
            </div>
            <p id={`${idPrefix}-pct-help`} className={`mt-2 text-xs ${invalid ? "text-danger" : "text-fg-subtle"}`}>
              {invalid ? `Bitte einen Wert zwischen 0 und ${MAX_RATE_PERCENT} eingeben.` : "In Prozent, steht in deinem letzten Steuerbescheid."}
            </p>
          </motion.div>
        ) : value.knows === false ? (
          <motion.fieldset key="brackets" {...anim} transition={{ duration: 0.25 }} className="mt-6">
            <legend className="text-sm font-medium text-fg">Geschätztes Gesamteinkommen</legend>
            <div className="mt-2 grid gap-2">
              {BRACKETS.map((b) => (
                <ChoiceTile key={b.code} active={value.bracket === b.code} onClick={() => onChange({ ...value, bracket: b.code })} title={b.label} aside={`ca. ${fmtPct(b.code)}`} />
              ))}
            </div>
          </motion.fieldset>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

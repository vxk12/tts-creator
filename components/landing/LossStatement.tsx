"use client";

import { motion, useReducedMotion } from "motion/react";
import { fmtEUR, fmtPct, offer } from "@/lib/pricing";

// Beispiel mit echten Werten aus der Preislogik (27 € Einkauf, Stufe Fair, 30 % Steuersatz)
const EX = offer(27, "fair", 0.3);

export function LossStatement() {
  const reduce = useReducedMotion();
  const lines = [
    { text: `${fmtEUR(EX.purchase)} bezahlt.`, cls: "text-fg-subtle" },
    { text: `${fmtEUR(EX.price)} verkauft.`, cls: "text-fg" },
    { text: `${fmtEUR(EX.back)} zurück.`, cls: "text-neon" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="max-w-4xl">
        <h2 className="sr-only">Was nach Steuer zurückkommt</h2>
        <p className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          {lines.map((l, i) => (
            <motion.span
              key={l.text}
              className={`block ${l.cls}`}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.8, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {l.text}
            </motion.span>
          ))}
        </p>
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 max-w-[60ch] text-lg leading-relaxed text-fg-muted"
        >
          Ein Verkauf unter Einkaufspreis mindert deine Steuer. Bei {fmtPct(EX.rate)} Steuersatz kommen beim Fair-Preis nicht nur{" "}
          {fmtEUR(EX.price)}, sondern {fmtEUR(EX.back)} bei dir an. Genau das zeigt dir der Bot zu jeder Preisstufe.
        </motion.p>
      </div>
    </section>
  );
}

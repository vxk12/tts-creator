"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { fmtEUR } from "@/lib/pricing";

/** Zählt Beträge weich auf den neuen Wert (Feedback auf Eingaben). Endet exakt auf dem Zielwert. */
export function AnimatedEuro({ value, className }: { value: number | null; className?: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value ?? 0, { stiffness: 170, damping: 26, restDelta: 0.001 });
  const text = useTransform(spring, (v) => fmtEUR(Math.max(0, Math.round(v * 100) / 100)));

  useEffect(() => {
    if (value == null) return;
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);

  if (value == null) return <span className={className}>-</span>;
  return <motion.span className={`tabular ${className ?? ""}`}>{text}</motion.span>;
}

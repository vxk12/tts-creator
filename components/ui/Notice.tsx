import { Info, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** Hinweis-, Fehler- oder Erfolgsmeldung (inline). */
export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-white/10 bg-white/[0.03] text-fg-muted",
    error: "border-danger/40 bg-danger/[0.08] text-[#ffc9c9]",
    success: "border-neon/40 bg-neon/[0.07] text-neon",
  }[tone];
  const Icon = tone === "error" ? WarningCircle : tone === "success" ? CheckCircle : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

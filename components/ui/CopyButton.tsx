"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* Clipboard nicht verfügbar */
        }
      }}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-xs font-medium text-fg transition-colors hover:border-white/35 active:scale-[0.98]"
    >
      {done ? <Check size={14} className="text-neon" /> : <Copy size={14} />}
      {done ? "Kopiert" : label}
    </button>
  );
}

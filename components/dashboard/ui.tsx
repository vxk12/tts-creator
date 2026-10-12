import type { ReactNode } from "react";

/** Kopf jeder Dashboard-Seite. */
export function PageHead({ title, text, actions }: { title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {text ? <p className="mt-2 max-w-[60ch] text-fg-muted">{text}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const inputCls =
  "h-12 w-full min-w-0 rounded-xl border border-white/12 bg-white/[0.03] px-4 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-neon aria-[invalid=true]:border-danger";

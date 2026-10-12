import type { Icon } from "@phosphor-icons/react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

/** Auswahl-Kachel (Onboarding, Steuersatz): Icon, Titel, Zusatz, Haken bei Auswahl. */
export function ChoiceTile({
  active,
  onClick,
  icon: IconCmp,
  title,
  text,
  aside,
}: {
  active: boolean;
  onClick: () => void;
  icon?: Icon;
  title: string;
  text?: string;
  aside?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-[border-color,background-color,transform] duration-200 ease-out-expo active:scale-[0.99] sm:px-5 ${
        active ? "border-neon/70 bg-neon/[0.06]" : "border-white/[0.09] bg-ink-900 hover:border-white/25 hover:bg-ink-850"
      }`}
    >
      {IconCmp ? (
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
            active ? "bg-neon text-neon-ink" : "bg-white/[0.05] text-fg-muted group-hover:text-fg"
          }`}
        >
          <IconCmp size={22} weight={active ? "fill" : "regular"} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${active ? "text-neon" : "text-fg"}`}>{title}</span>
        {text ? <span className="mt-0.5 block text-sm text-fg-muted">{text}</span> : null}
      </span>
      {aside ? <span className={`shrink-0 text-sm tabular ${active ? "text-neon" : "text-fg-subtle"}`}>{aside}</span> : null}
      <CheckCircle
        size={22}
        weight="fill"
        aria-hidden="true"
        className={`shrink-0 text-neon transition-[opacity,transform] duration-200 ease-out-expo ${active ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
      />
    </button>
  );
}

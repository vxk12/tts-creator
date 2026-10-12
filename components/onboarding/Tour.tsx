"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, ArrowRight, ChartBar, CheckCircle, CurrencyEur, DownloadSimple, LinkSimple, Package, Percent, Receipt,
  SquaresFour, Tag, TelegramLogo, UploadSimple, type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { TierList } from "@/components/pricing/TierList";
import type { PriceChoice } from "@/lib/pricing";

const ease = [0.16, 1, 0.3, 1] as const;

interface Slide {
  icon: Icon;
  title: string;
  text: string;
  body: (props: { rate: number | null }) => ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: TelegramLogo,
    title: "Samples per Telegram hochladen",
    text: "Der schnellste Weg: Link an den Bot schicken, Einkaufspreis eingeben, Preis wählen. Fertig.",
    body: () => (
      <Rows
        items={[
          { icon: LinkSimple, title: "TikTok-Shop-Link schicken", text: "Produktname und Bild holt der Bot automatisch." },
          { icon: CurrencyEur, title: "Einkaufspreis eingeben", text: "Oder mit einem Tipp den Shop-Preis übernehmen." },
          { icon: Tag, title: "Preis wählen", text: "Einen Vorschlag nehmen oder eigenen Preis schicken." },
          { icon: CheckCircle, title: "Hochgeladen", text: "Das Sample landet sofort in deinem Dashboard." },
        ]}
      />
    ),
  },
  {
    icon: Tag,
    title: "Vorschlag oder eigener Preis",
    text: "Wir schlagen dir drei Preise vor. Du kannst aber immer deinen eigenen festlegen. Probier es aus:",
    body: ({ rate }) => <PricePreview rate={rate} />,
  },
  {
    icon: SquaresFour,
    title: "Alles im Dashboard",
    text: "Dort siehst du alle Samples und behältst den Überblick. Hochladen geht auch direkt im Browser.",
    body: () => (
      <Rows
        items={[
          { icon: Package, title: "Samples verwalten", text: "Filtern, suchen, Details zu jedem Sample." },
          { icon: Tag, title: "Preise ändern", text: "Jederzeit auf einen Vorschlag oder einen eigenen Preis." },
          { icon: CheckCircle, title: "Als verkauft markieren", text: "Mit Preis und Datum, für deine Übersicht." },
          { icon: UploadSimple, title: "Im Browser hochladen", text: "Falls du gerade nicht in Telegram bist." },
        ]}
      />
    ),
  },
  {
    icon: Receipt,
    title: "Steuer-Bereich",
    text: "Optional, aber praktisch, wenn du mit TikTok Shop Geld verdienst.",
    body: () => (
      <Rows
        items={[
          { icon: Receipt, title: "Rechnungen erstellen", text: "Mit fortlaufender Nummer, als PDF speichern." },
          { icon: ChartBar, title: "Jahresübersicht", text: "Warenwert, Verkaufserlöse und Rechnungen pro Jahr." },
          { icon: DownloadSimple, title: "Export", text: "CSV für die Steuererklärung oder den Steuerberater." },
          { icon: Percent, title: "Mehr über die Steuer", text: "Mit Steuersatz siehst du, was später zusätzlich zurückkommt." },
        ]}
      />
    ),
  },
];

/** Kurze Tour nach der Registrierung: die wichtigsten Funktionen, Folie für Folie. */
export function Tour({ userId, rate, onDone }: { userId: string; rate: number | null; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const to = (n: number) => {
    setDir(n > i ? 1 : -1);
    setI(n);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const next = () => (last ? onDone() : to(i + 1));

  // Pfeiltasten (außer beim Tippen in ein Feld)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft" && i > 0) to(i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <p className="mb-8 flex items-center justify-center gap-2 text-sm text-neon">
        <CheckCircle size={18} weight="fill" aria-hidden="true" /> Konto @{userId} angelegt. Kurze Tour, dann geht's los.
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1.5" role="tablist" aria-label="Tour">
          {SLIDES.map((s, n) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`${n + 1}. ${s.title}`}
              onClick={() => to(n)}
              className="grid h-6 place-items-center"
            >
              <span className={`block h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-6 bg-neon" : n < i ? "w-1.5 bg-neon/50" : "w-1.5 bg-white/20"}`} />
            </button>
          ))}
        </div>
        <button type="button" onClick={onDone} className="text-sm text-fg-muted transition-colors hover:text-fg">
          Tour überspringen
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={i}
          custom={dir}
          variants={{
            enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 32 * d }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -32 * d }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease }}
          className="mt-8"
          aria-live="polite"
        >
          <div className="text-center">
            <motion.div
              initial={reduce ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-neon text-neon-ink"
              aria-hidden="true"
            >
              <slide.icon size={30} weight="fill" />
            </motion.div>
            <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">{slide.title}</h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-pretty leading-relaxed text-fg-muted sm:text-lg">{slide.text}</p>
          </div>
          <div className="mt-8">{slide.body({ rate })}</div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between gap-3">
        {i > 0 ? (
          <Button type="button" variant="ghost" size="lg" onClick={() => to(i - 1)}>
            <ArrowLeft size={16} /> Zurück
          </Button>
        ) : <span />}
        <Button type="button" size="lg" onClick={next}>
          {last ? "Los geht's" : "Weiter"} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

function Rows({ items }: { items: { icon: Icon; title: string; text: string }[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-2 rounded-card border border-white/[0.08] bg-ink-900 p-2">
      {items.map((it, n) => (
        <motion.li
          key={it.title}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 + n * 0.07, ease }}
          className="flex items-center gap-4 rounded-xl px-3 py-3"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-neon" aria-hidden="true">
            <it.icon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{it.title}</span>
            <span className="block text-sm text-fg-muted">{it.text}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/** Die echte Preisauswahl mit einem Beispiel-Sample. */
function PricePreview({ rate }: { rate: number | null }) {
  const [choice, setChoice] = useState<PriceChoice>("fair");
  const [customText, setCustomText] = useState("");
  return (
    <div>
      <p className="mb-3 text-center text-sm text-fg-subtle">Beispiel: Sample mit 27,00 € Einkaufspreis</p>
      <TierList purchase={27} rate={rate} value={choice} onChange={setChoice} name="tour-tier" custom={{ text: customText, onText: setCustomText }} />
    </div>
  );
}

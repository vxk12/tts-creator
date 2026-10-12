"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Storefront, TelegramLogo, UserMinus, X, XCircle } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { CopyButton } from "@/components/ui/CopyButton";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";
import { RateSelector, emptyRate, rateError, rateFromState, stateFromRate, type RateState } from "@/components/pricing/RateSelector";
import { TaxBreakdown } from "@/components/pricing/TaxBreakdown";
import { USER_RE, normalizeUser, register, session, telegramBotLink } from "@/lib/api";
import { fmtPct } from "@/lib/pricing";

type Step = "creator" | "user" | "tax" | "denied" | "success";

const STEPS = [
  { id: "creator", label: "Creator" },
  { id: "user", label: "Profil" },
  { id: "tax", label: "Steuer" },
] as const;

const ease = [0.16, 1, 0.3, 1] as const;

export function Onboarding() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("creator");
  const [dir, setDir] = useState(1);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);
  const [userId, setUserId] = useState("");
  const [userError, setUserError] = useState("");
  const [rate, setRate] = useState<RateState>(emptyRate);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ userId: string; statusCode: number; creatorKey: string } | null>(null);
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Vorbelegung aus dem Preisrechner (?rate=0.3)
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("rate");
    const r = Number(raw);
    if (raw && Number.isFinite(r) && r >= 0 && r <= 0.6) setRate(stateFromRate(r));
    return () => clearTimeout(advance.current);
  }, []);

  const order = (s: Step) => (s === "success" ? 3 : s === "denied" ? 0 : STEPS.findIndex((x) => x.id === s));

  const go = (s: Step) => {
    setDir(order(s) >= order(step) ? 1 : -1);
    setError("");
    setStep(s);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  // Kurz die Auswahl zeigen, dann weiter
  const pickCreator = (yes: boolean) => {
    setIsCreator(yes);
    clearTimeout(advance.current);
    advance.current = setTimeout(() => go(yes ? "user" : "denied"), reduce ? 0 : 200);
  };

  function checkUser() {
    const v = normalizeUser(userId);
    setUserId(v);
    if (!USER_RE.test(v)) {
      setUserError("Bitte gib einen gültigen TikTok-Username ein (2 bis 24 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich).");
      return false;
    }
    setUserError("");
    return true;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step !== "tax") return;
    if (isCreator !== true) return go("creator");
    if (!checkUser()) return go("user");
    const err = rateError(rate);
    if (err) return setError(err);
    const statusCode = rateFromState(rate)!;
    setBusy(true);
    setError("");
    try {
      const res = await register({ isShopCreator: true, userId, statusCode });
      session.set({ userId: res.creator.userId, creatorKey: res.creatorKey });
      setResult({ userId: res.creator.userId, statusCode: res.creator.statusCode, creatorKey: res.creatorKey });
      go("success");
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const currentRate = rateFromState(rate);
  const userValid = USER_RE.test(normalizeUser(userId));
  const slide = reduce
    ? {}
    : {
        custom: dir,
        variants: {
          enter: (d: number) => ({ opacity: 0, x: 32 * d }),
          center: { opacity: 1, x: 0 },
          exit: (d: number) => ({ opacity: 0, x: -32 * d }),
        },
        initial: "enter",
        animate: "center",
        exit: "exit",
        transition: { duration: 0.28, ease },
      };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div>
            <Logo />
          </div>
          <Stepper current={order(step)} hidden={step === "denied"} />
          <div className="flex justify-end">
            <Link
              href="/"
              aria-label="Registrierung abbrechen"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <span className="hidden sm:inline">Abbrechen</span>
              <X size={18} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-clip px-4 pb-24 pt-10 sm:px-6 sm:pt-16 md:pt-20">
        <form onSubmit={submit} noValidate className="mx-auto w-full max-w-[36rem]">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            {step === "creator" && (
              <motion.section key="creator" {...slide}>
                <Head title="Bist du TikTok Shop Creator?" text="Die Plattform ist exklusiv für offizielle TikTok Shop Creator." />
                <div className="mt-10 grid gap-3">
                  <ChoiceTile active={isCreator === true} onClick={() => pickCreator(true)} icon={Storefront} title="Ja, bin ich" text="Ich verkaufe als Creator über TikTok Shop" />
                  <ChoiceTile active={isCreator === false} onClick={() => pickCreator(false)} icon={UserMinus} title="Nein, noch nicht" text="Ich bin noch kein TikTok Shop Creator" />
                </div>
              </motion.section>
            )}

            {step === "denied" && (
              <motion.section key="denied" {...slide} className="text-center">
                <Badge tone="danger"><XCircle size={30} weight="fill" /></Badge>
                <Head title="Nutzung leider nicht möglich" text="Die Plattform steht nur offiziellen TikTok Shop Creators zur Verfügung. Sobald du freigeschaltet bist, kannst du dich hier registrieren." />
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  <Button type="button" variant="secondary" size="lg" onClick={() => go("creator")}>
                    <ArrowLeft size={16} /> Zurück
                  </Button>
                  <Link href="/" className={buttonClass("ghost", "lg")}>Zur Startseite</Link>
                </div>
              </motion.section>
            )}

            {step === "user" && (
              <motion.section key="user" {...slide}>
                <Head title="Wie heißt du auf TikTok?" text="Dein Username wird deine Creator-ID auf der Plattform." />
                <div className="mt-10 grid gap-2">
                  <label htmlFor="userId" className="text-sm font-medium text-fg">TikTok-Username</label>
                  <div
                    className={`flex h-16 items-center gap-1 rounded-xl border bg-ink-900 px-4 transition-colors focus-within:border-neon ${
                      userError ? "border-danger" : "border-white/[0.12]"
                    }`}
                  >
                    <span className="text-2xl text-fg-subtle">@</span>
                    <input
                      id="userId"
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      maxLength={25}
                      placeholder="deinusername"
                      value={userId}
                      onChange={(e) => { setUserId(e.target.value); setUserError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (checkUser()) go("tax"); } }}
                      aria-invalid={!!userError}
                      aria-describedby="userId-help"
                      className="w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-subtle/60"
                    />
                    <motion.span
                      aria-hidden="true"
                      initial={false}
                      animate={{ opacity: userValid ? 1 : 0, scale: userValid ? 1 : 0.5 }}
                      transition={{ duration: reduce ? 0 : 0.2 }}
                      className="grid size-7 place-items-center rounded-full bg-neon text-neon-ink"
                    >
                      <Check size={15} weight="bold" />
                    </motion.span>
                  </div>
                  <p id="userId-help" className={`text-xs ${userError ? "text-danger" : "text-fg-subtle"}`}>
                    {userError || "2 bis 24 Zeichen: Buchstaben, Zahlen, Punkt und Unterstrich."}
                  </p>
                </div>
                <Actions>
                  <Button type="button" variant="ghost" size="lg" onClick={() => go("creator")}>
                    <ArrowLeft size={16} /> Zurück
                  </Button>
                  <Button type="button" size="lg" onClick={() => checkUser() && go("tax")}>
                    Weiter <ArrowRight size={16} />
                  </Button>
                </Actions>
              </motion.section>
            )}

            {step === "tax" && (
              <motion.section key="tax" {...slide}>
                <Head title="Kennst du deinen exakten Grenzsteuersatz?" text="Damit zeigen wir dir zu jedem Sample, wie viel du nach Steuer zurückbekommst." />
                <div className="mt-10">
                  <RateSelector value={rate} onChange={(s) => { setRate(s); setError(""); }} idPrefix="ob" showQuestion={false} />
                </div>

                <AnimatePresence initial={false}>
                  {currentRate != null ? (
                    <motion.div
                      key="calc"
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      transition={{ duration: 0.35, ease }}
                      className="mt-8"
                    >
                      <TaxBreakdown rate={currentRate} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-4">
                  <Notice>
                    Die Einschätzung über dein Einkommen ist ein Näherungswert und nicht 100 % genau. Für das beste Ergebnis schau in deinem letzten Steuerbescheid nach. Du kannst deinen Steuersatz jederzeit im Dashboard ändern.
                  </Notice>
                </div>
                {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
                <Actions>
                  <Button type="button" variant="ghost" size="lg" onClick={() => go("user")}>
                    <ArrowLeft size={16} /> Zurück
                  </Button>
                  <Button type="submit" size="lg" disabled={busy}>
                    {busy ? "Wird gespeichert …" : "Konto erstellen"}
                  </Button>
                </Actions>
              </motion.section>
            )}

            {step === "success" && result && (
              <motion.section key="success" {...slide}>
                <div className="text-center">
                  <Badge tone="neon"><CheckCircle size={30} weight="fill" /></Badge>
                  <Head title={`Willkommen, @${result.userId}!`} text="Dein Konto ist angelegt. Verbinde jetzt Telegram, darüber lädst du deine Samples hoch." />
                </div>

                <div className="mt-10 rounded-card border border-white/[0.08] bg-ink-900 p-5 sm:p-6">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-fg-muted">Creator-ID</dt>
                      <dd className="mt-1 text-base font-medium">@{result.userId}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-muted">Steuersatz</dt>
                      <dd className="mt-1 text-base font-medium tabular">{fmtPct(result.statusCode)}</dd>
                    </div>
                  </dl>
                  <div className="mt-6 border-t border-white/[0.08] pt-5">
                    <p className="text-sm font-medium text-fg">Dein Creator-Key</p>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-neon/50 bg-neon/[0.04] px-4 py-3">
                      <code className="break-all font-mono text-sm text-neon">{result.creatorKey}</code>
                      <CopyButton text={result.creatorKey} />
                    </div>
                    <p className="mt-2 text-xs text-fg-subtle">Speichere den Key gut. Du brauchst ihn für den Login im Bot und im Dashboard.</p>
                  </div>
                </div>

                <ol className="mt-8 grid gap-3 text-sm leading-relaxed text-fg-muted">
                  {[
                    "Tippe auf „Mit Telegram verbinden“. Der Bot öffnet sich mit deinem Username.",
                    "Schick dem Bot deinen Creator-Key. Er löscht die Nachricht sofort wieder.",
                    "Fertig: Der Bot kennt jetzt dein Konto und deinen Steuersatz.",
                  ].map((t, i) => (
                    <motion.li
                      key={t}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.25 + i * 0.08, ease }}
                      className="flex gap-3"
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neon/[0.12] text-xs font-medium text-neon tabular">{i + 1}</span>
                      {t}
                    </motion.li>
                  ))}
                </ol>

                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  <a href={telegramBotLink(result.userId)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
                    <TelegramLogo size={18} weight="fill" /> Mit Telegram verbinden
                  </a>
                  <Link href="/dashboard" className={buttonClass("secondary", "lg")}>Zum Dashboard</Link>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </form>
      </main>
    </div>
  );
}

/** Fortschritt in der Kopfzeile: erledigt = Haken, aktuell = Neon-Ring. */
function Stepper({ current, hidden }: { current: number; hidden: boolean }) {
  return (
    <ol aria-label="Fortschritt" className={`flex items-center gap-2 transition-opacity duration-300 sm:gap-3 ${hidden ? "opacity-0" : "opacity-100"}`}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
            {i > 0 ? (
              <span className="relative h-px w-5 overflow-hidden bg-white/15 sm:w-8" aria-hidden="true">
                <span className={`absolute inset-0 origin-left bg-neon transition-transform duration-500 ease-out-expo ${i <= current ? "scale-x-100" : "scale-x-0"}`} />
              </span>
            ) : null}
            <span
              className={`grid size-6 place-items-center rounded-full text-xs font-medium tabular transition-colors duration-300 ${
                done ? "bg-neon text-neon-ink" : active ? "text-neon ring-1 ring-neon" : "text-fg-subtle ring-1 ring-white/15"
              }`}
            >
              {done ? <Check size={12} weight="bold" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`hidden text-sm md:inline ${active ? "text-fg" : "text-fg-subtle"}`}>
              {s.label}
              <span className="sr-only">{done ? " (erledigt)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Head({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-center">
      <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-[2.75rem]">{title}</h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">{text}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "neon" | "danger"; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
      className={`mx-auto mb-6 grid size-16 place-items-center rounded-full ${tone === "neon" ? "bg-neon/[0.12] text-neon" : "bg-danger/[0.12] text-danger"}`}
      aria-hidden="true"
    >
      {children}
    </motion.div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-10 flex items-center justify-between gap-3">{children}</div>;
}

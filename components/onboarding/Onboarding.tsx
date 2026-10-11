"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle, TelegramLogo, XCircle } from "@phosphor-icons/react";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { CopyButton } from "@/components/ui/CopyButton";
import { RateSelector, emptyRate, rateError, rateFromState, stateFromRate, type RateState } from "@/components/pricing/RateSelector";
import { USER_RE, normalizeUser, register, session, telegramBotLink } from "@/lib/api";
import { fmtEUR, fmtPct, offer } from "@/lib/pricing";

type Step = 1 | 2 | 3 | "denied" | "success";

const choiceCls = (active: boolean) =>
  `h-16 rounded-xl border text-lg font-medium transition-colors duration-200 active:scale-[0.99] ${
    active ? "border-neon/70 bg-neon/[0.07] text-neon" : "border-white/10 text-fg hover:border-white/30"
  }`;

export function Onboarding() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(1);
  const [isCreator, setIsCreator] = useState<boolean | null>(null);
  const [userId, setUserId] = useState("");
  const [userError, setUserError] = useState("");
  const [rate, setRate] = useState<RateState>(emptyRate);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ userId: string; statusCode: number; creatorKey: string } | null>(null);

  // Vorbelegung aus dem Preisrechner (?rate=0.3)
  useEffect(() => {
    const r = Number(new URLSearchParams(window.location.search).get("rate"));
    if (Number.isFinite(r) && r >= 0 && r <= 0.6 && window.location.search.includes("rate=")) setRate(stateFromRate(r));
  }, []);

  const go = (s: Step) => {
    setError("");
    setStep(s);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
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
    if (isCreator !== true) return go(1);
    if (!checkUser()) return go(2);
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
  const example = currentRate != null ? offer(27, "fair", currentRate) : null;
  const progress = step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : 0;
  const motionProps = reduce
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8">
      <form onSubmit={submit} noValidate className="max-w-xl">
        {progress ? (
          <div className="mb-10 flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= progress ? "bg-neon" : "bg-white/10"}`} />
            ))}
          </div>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.section key="s1" {...motionProps}>
              <StepHead n={1} title="Bist du offizieller TikTok Shop Creator?" text="Die Plattform ist exklusiv für TikTok Shop Creator." />
              <div className="mt-8 grid grid-cols-2 gap-3">
                <button type="button" aria-pressed={isCreator === true} className={choiceCls(isCreator === true)} onClick={() => { setIsCreator(true); go(2); }}>
                  JA
                </button>
                <button type="button" aria-pressed={isCreator === false} className={choiceCls(isCreator === false)} onClick={() => { setIsCreator(false); go("denied"); }}>
                  NEIN
                </button>
              </div>
            </motion.section>
          )}

          {step === "denied" && (
            <motion.section key="denied" {...motionProps}>
              <XCircle size={44} weight="light" className="text-danger" aria-hidden="true" />
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Nutzung leider nicht möglich</h1>
              <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-fg-muted">
                Die Plattform steht nur offiziellen TikTok Shop Creators zur Verfügung. Sobald du freigeschaltet bist, kannst du dich hier registrieren.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => go(1)}>Zurück</Button>
                <ButtonLink href="/" variant="ghost">Zur Startseite</ButtonLink>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section key="s2" {...motionProps}>
              <StepHead n={2} title="Wie lautet dein TikTok-Username?" text="Er wird deine Creator-ID auf der Plattform." />
              <div className="mt-8 grid gap-2">
                <label htmlFor="userId" className="text-sm font-medium text-fg">TikTok-Username</label>
                <div className={`flex items-baseline gap-1 border-b pb-1.5 transition-colors focus-within:border-neon ${userError ? "border-danger" : "border-white/20"}`}>
                  <span className="text-3xl text-fg-subtle">@</span>
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
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (checkUser()) go(3); } }}
                    aria-invalid={!!userError}
                    aria-describedby="userId-help"
                    className="w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-subtle/60"
                  />
                </div>
                <p id="userId-help" className={`text-xs ${userError ? "text-danger" : "text-fg-subtle"}`}>
                  {userError || "2 bis 24 Zeichen: Buchstaben, Zahlen, Punkt und Unterstrich."}
                </p>
              </div>
              <Actions>
                <Button type="button" variant="secondary" onClick={() => go(1)}>Zurück</Button>
                <Button type="button" onClick={() => checkUser() && go(3)}>Weiter <ArrowRight size={16} /></Button>
              </Actions>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section key="s3" {...motionProps}>
              <StepHead n={3} title="Kennst du deinen exakten Grenzsteuersatz?" text="Damit zeigen wir dir später zu jedem Sample deinen echten Verlust nach Steuer." />
              <div className="mt-8">
                <RateSelector value={rate} onChange={(s) => { setRate(s); setError(""); }} idPrefix="ob" showQuestion={false} />
              </div>
              <div className="mt-6">
                <Notice>
                  Die Einschätzung über dein Einkommen ist ein Näherungswert und nicht 100 % genau. Für das beste Ergebnis schau in deinem letzten Steuerbescheid nach. Du kannst deinen Steuersatz jederzeit im Dashboard ändern.
                </Notice>
              </div>
              {example ? (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-neon px-5 py-4 text-neon-ink">
                  <span className="text-sm">
                    Beispiel: {fmtEUR(example.purchase)} Einkauf, Stufe Fair für {fmtEUR(example.price)}. Echter Verlust:
                  </span>
                  <span className="text-2xl font-semibold tracking-tight tabular">{fmtEUR(example.loss)}</span>
                </div>
              ) : null}
              {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
              <Actions>
                <Button type="button" variant="secondary" onClick={() => go(2)}>Zurück</Button>
                <Button type="submit" disabled={busy}>{busy ? "Wird gespeichert …" : "Registrierung abschließen"}</Button>
              </Actions>
            </motion.section>
          )}

          {step === "success" && result && (
            <motion.section key="success" {...motionProps}>
              <CheckCircle size={44} weight="light" className="text-neon" aria-hidden="true" />
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Willkommen, @{result.userId}!</h1>
              <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-fg-muted">
                Dein Konto ist angelegt. Jetzt noch Telegram verbinden, darüber lädst du deine Samples hoch.
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-1 border-y border-white/[0.08] py-5 text-sm">
                <dt className="text-fg-muted">Creator-ID</dt>
                <dt className="text-fg-muted">Steuersatz</dt>
                <dd className="text-base font-medium">@{result.userId}</dd>
                <dd className="text-base font-medium tabular">{fmtPct(result.statusCode)}</dd>
              </dl>

              <div className="mt-8">
                <p className="text-sm font-medium text-fg">Dein Creator-Key</p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-neon/50 px-4 py-3">
                  <code className="break-all font-mono text-sm text-neon">{result.creatorKey}</code>
                  <CopyButton text={result.creatorKey} />
                </div>
                <p className="mt-2 text-xs text-fg-subtle">Speichere den Key gut. Du brauchst ihn für den Login im Bot und im Dashboard.</p>
              </div>

              <ol className="mt-8 grid gap-3 text-sm leading-relaxed text-fg-muted">
                {[
                  "Tippe auf „Mit Telegram verbinden“. Der Bot öffnet sich mit deinem Username.",
                  "Schick dem Bot deinen Creator-Key. Er löscht die Nachricht sofort wieder.",
                  "Fertig: Der Bot kennt jetzt dein Konto und deinen Steuersatz.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neon/[0.12] text-xs font-medium text-neon tabular">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>

              <div className="mt-9 flex flex-wrap gap-3">
                <a href={telegramBotLink(result.userId)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
                  <TelegramLogo size={18} weight="fill" /> Mit Telegram verbinden
                </a>
                <Link href="/dashboard" className={buttonClass("secondary", "lg")}>Zum Dashboard</Link>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </form>

      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-card border border-white/[0.07] bg-ink-900 p-6">
          <p className="text-sm font-medium text-fg">Was wir speichern</p>
          <dl className="mt-4 grid gap-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">User_ID <span className="text-fg-subtle">(Spalte B)</span></dt>
              <dd className="font-medium">{userId && USER_RE.test(userId) ? `@${userId}` : "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Status_Code <span className="text-fg-subtle">(Spalte C)</span></dt>
              <dd className="font-medium tabular">{currentRate != null ? currentRate.toFixed(2) : "-"}</dd>
            </div>
          </dl>
          <p className="mt-6 border-t border-white/[0.08] pt-5 text-sm leading-relaxed text-fg-muted">
            Danach verbindest du Telegram und lädst deine Samples über den Bot hoch.
          </p>
        </div>
      </aside>
    </div>
  );
}

function StepHead({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <>
      <p className="text-sm text-fg-subtle tabular">Schritt {n} von 3</p>
      <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-fg-muted">{text}</p>
    </>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-9 flex flex-wrap gap-3">{children}</div>;
}

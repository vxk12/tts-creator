"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Eye, EyeSlash, Package, SignOut, TelegramLogo, CaretDown } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { CopyButton } from "@/components/ui/CopyButton";
import { RateSelector, rateError, rateFromState, stateFromRate, type RateState } from "@/components/pricing/RateSelector";
import { TierList } from "@/components/pricing/TierList";
import { AnimatedEuro } from "@/components/pricing/AnimatedEuro";
import {
  addSample, getSamples, login, normalizeUser, session, telegramBotLink, updateStatus,
  type Creator, type Credentials, type Sample,
} from "@/lib/api";
import { fmtEUR, fmtPct, offer, parseMoney, type TierId } from "@/lib/pricing";

const inputCls =
  "h-12 w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-neon aria-[invalid=true]:border-danger";

export function Dashboard() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState("");

  const doLogin = useCallback(async (c: Credentials) => {
    const res = await login(c);
    const next = { userId: res.creator.userId, creatorKey: c.creatorKey };
    session.set(next);
    setCreds(next);
    setCreator(res.creator);
  }, []);

  useEffect(() => {
    const saved = session.get();
    if (!saved) return setBooting(false);
    doLogin(saved)
      .catch((e: Error) => { session.clear(); setLoginError(e.message); })
      .finally(() => setBooting(false));
  }, [doLogin]);

  if (booting) return <DashboardSkeleton />;
  if (!creds || !creator) return <LoginForm onLogin={doLogin} initialError={loginError} />;
  return (
    <LoggedIn
      creds={creds}
      creator={creator}
      onCreator={setCreator}
      onLogout={() => { session.clear(); setCreds(null); setCreator(null); }}
    />
  );
}

/* ------------------------------------------------------------------ */

function LoginForm({ onLogin, initialError }: { onLogin: (c: Credentials) => Promise<void>; initialError: string }) {
  const [userId, setUserId] = useState(() => (typeof window !== "undefined" ? session.get()?.userId ?? "" : ""));
  const [key, setKey] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !key.trim()) return setError("Bitte Username und Creator-Key eingeben.");
    setBusy(true);
    setError("");
    try {
      await onLogin({ userId: normalizeUser(userId), creatorKey: key.trim() });
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-14 sm:px-6 md:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Login</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-muted">Mit deinem TikTok-Username und dem Creator-Key aus der Registrierung.</p>
      <form onSubmit={submit} noValidate className="mt-10 grid gap-6">
        <div className="grid gap-2">
          <label htmlFor="login-user" className="text-sm font-medium">TikTok-Username</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">@</span>
            <input id="login-user" autoComplete="username" autoCapitalize="off" spellCheck={false} value={userId} onChange={(e) => setUserId(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="login-key" className="text-sm font-medium">Creator-Key</label>
          <input id="login-key" type="password" autoComplete="current-password" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} className={`${inputCls} font-mono`} />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Wird geprüft …" : "Login"}</Button>
      </form>
      <p className="mt-8 text-sm text-fg-muted">
        Noch kein Konto? <Link href="/registrieren" className="font-medium text-fg underline decoration-white/30 underline-offset-4 hover:decoration-neon">Registrieren</Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LoggedIn({ creds, creator, onCreator, onLogout }: {
  creds: Credentials; creator: Creator; onCreator: (c: Creator) => void; onLogout: () => void;
}) {
  const reduce = useReducedMotion();
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [samplesError, setSamplesError] = useState("");

  const loadSamples = useCallback(async () => {
    try {
      setSamples(await getSamples(creator.userId));
      setSamplesError("");
    } catch (e) {
      setSamplesError((e as Error).message);
      setSamples([]);
    }
  }, [creator.userId]);

  useEffect(() => { loadSamples(); }, [loadSamples]);

  const viaTelegram = samples?.filter((s) => s.source === "Telegram").length ?? 0;
  const enter = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 md:pt-14 lg:px-8">
      <motion.div {...enter(0)} className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Hi @{creator.userId}</h1>
        <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-fg">
          <SignOut size={16} /> Abmelden
        </button>
      </motion.div>

      <motion.dl {...enter(1)} className="mt-10 grid grid-cols-3 gap-6">
        {[
          { k: "Steuersatz", v: fmtPct(creator.statusCode) },
          { k: "Samples", v: samples ? String(samples.length) : "-" },
          { k: "per Telegram", v: samples ? String(viaTelegram) : "-" },
        ].map((m) => (
          <div key={m.k} className="border-t border-white/[0.12] pt-4">
            <dt className="text-sm text-fg-muted">{m.k}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight tabular md:text-4xl">{m.v}</dd>
          </div>
        ))}
      </motion.dl>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <motion.div {...enter(2)}><TelegramPanel creds={creds} /></motion.div>
        <motion.div {...enter(3)}><RatePanel creds={creds} creator={creator} onCreator={onCreator} /></motion.div>
      </div>

      <motion.section {...enter(4)} aria-labelledby="samples-title" className="mt-4 rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
        <h2 id="samples-title" className="text-2xl font-semibold tracking-tight">Deine Samples</h2>
        {samples === null ? (
          <div className="mt-6 grid gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}
          </div>
        ) : samplesError ? (
          <div className="mt-6"><Notice tone="error">{samplesError}</Notice></div>
        ) : samples.length === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-dashed border-white/12 px-6 py-10">
            <Package size={32} weight="light" className="text-fg-subtle" aria-hidden="true" />
            <p className="max-w-[46ch] text-fg-muted">Noch keine Samples. Schick dem Telegram-Bot einen TikTok-Shop-Link, dann taucht dein erstes Sample hier auf.</p>
            <a href={telegramBotLink(creator.userId)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              <TelegramLogo size={16} weight="fill" /> Mit Telegram verbinden
            </a>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-white/[0.07]">
            {samples.map((s) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-4">
                <span className="truncate font-medium">{s.name || "TikTok Shop Produkt"}</span>
                <span className="row-span-2 text-right text-xl font-semibold tracking-tight text-neon tabular">{fmtEUR(s.price)}</span>
                <span className="text-sm text-fg-muted">
                  Einkauf {fmtEUR(s.purchasePrice ?? s.originalPrice ?? NaN)}
                  {s.tier ? `, Stufe ${s.tier}` : ""}
                  {s.source ? `, via ${s.source}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <WebUpload creds={creds} creator={creator} onDone={loadSamples} />
      </motion.section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TelegramPanel({ creds }: { creds: Credentials }) {
  const [show, setShow] = useState(false);
  return (
    <section aria-labelledby="tg-title" className="flex h-full flex-col rounded-card bg-neon p-6 text-neon-ink sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id="tg-title" className="text-2xl font-semibold tracking-tight">Telegram verbinden</h2>
        <TelegramLogo size={32} weight="fill" aria-hidden="true" />
      </div>
      <p className="mt-3 max-w-[48ch] leading-relaxed text-neon-ink/80">
        Hochgeladen wird über den Bot. Dort meldest du dich einmalig mit Username und Creator-Key an.
      </p>
      <div className="mt-6 rounded-xl bg-neon-ink/[0.08] p-4">
        <p className="text-xs font-medium text-neon-ink/70">Dein Creator-Key</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="mr-auto break-all font-mono text-sm">{show ? creds.creatorKey : "••••••••••••••••"}</code>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neon-ink/25 px-3.5 text-xs font-medium hover:border-neon-ink/60"
          >
            {show ? <EyeSlash size={14} /> : <Eye size={14} />} {show ? "Verbergen" : "Anzeigen"}
          </button>
          <span className="[&>button]:border-neon-ink/25 [&>button]:text-neon-ink [&>button:hover]:border-neon-ink/60">
            <CopyButton text={creds.creatorKey} />
          </span>
        </div>
      </div>
      <a
        href={telegramBotLink(creds.userId)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-neon-ink px-6 text-[15px] font-medium text-neon transition-transform active:scale-[0.98]"
        style={{ marginTop: "1.75rem" }}
      >
        <TelegramLogo size={18} weight="fill" /> Mit Telegram verbinden
      </a>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RatePanel({ creds, creator, onCreator }: { creds: Credentials; creator: Creator; onCreator: (c: Creator) => void }) {
  const [state, setState] = useState<RateState>(() => stateFromRate(creator.statusCode));
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const err = rateError(state);
    if (err) return setMsg({ tone: "error", text: err });
    setBusy(true);
    try {
      const res = await updateStatus(creds, rateFromState(state)!);
      onCreator(res.creator);
      setMsg({ tone: "success", text: `Gespeichert: ${fmtPct(res.creator.statusCode)}. Der Bot übernimmt den neuen Steuersatz automatisch.` });
    } catch (ex) {
      setMsg({ tone: "error", text: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby="rate-title" className="h-full rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
      <h2 id="rate-title" className="text-2xl font-semibold tracking-tight">Dein Steuersatz</h2>
      <p className="mt-3 leading-relaxed text-fg-muted">
        Aktuell <span className="font-medium text-fg">{fmtPct(creator.statusCode)}</span>. Daraus berechnen Bot und Web-App deinen echten Verlust.
      </p>
      <div className="mt-6">
        <RateSelector value={state} onChange={(s) => { setState(s); setMsg(null); }} idPrefix="dash" />
      </div>
      <div className="mt-6">
        <Notice>Die Schätzung über dein Einkommen ist ein Näherungswert. Den genauen Satz findest du in deinem letzten Steuerbescheid.</Notice>
      </div>
      {msg ? <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      <Button type="submit" variant="secondary" className="mt-6" disabled={busy}>{busy ? "Wird gespeichert …" : "Steuersatz speichern"}</Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function WebUpload({ creds, creator, onDone }: { creds: Credentials; creator: Creator; onDone: () => void }) {
  const [link, setLink] = useState("");
  const [priceText, setPriceText] = useState("");
  const [video, setVideo] = useState("");
  const [tierId, setTierId] = useState<TierId>("fair");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const p = parseMoney(priceText);
  const purchase = Number.isFinite(p) && p > 0 && p <= 100000 ? p : null;
  const o = purchase != null ? offer(purchase, tierId, creator.statusCode) : null;
  const urlOk = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems = [!urlOk(link) && "TikTok-Shop-Link", purchase == null && "Einkaufspreis", video.trim() && !urlOk(video) && "Video-Link"].filter(Boolean);
    if (problems.length) return setMsg({ tone: "error", text: `Bitte prüfe: ${problems.join(", ")}.` });
    setBusy(true);
    try {
      const res = await addSample(creds, { shopLink: link.trim(), price: purchase!, tier: tierId, videoLink: video.trim() || undefined });
      setMsg({ tone: "success", text: `Hochgeladen für ${fmtEUR(res.product.price ?? o!.price)} (Stufe ${o!.tier.label}).` });
      setLink(""); setPriceText(""); setVideo("");
      onDone();
    } catch (ex) {
      setMsg({ tone: "error", text: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group mt-8 rounded-xl border border-white/[0.08]">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
        Lieber im Browser hochladen?
        <CaretDown size={16} className="transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <form onSubmit={submit} noValidate className="grid gap-8 border-t border-white/[0.08] p-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <label htmlFor="up-link" className="text-sm font-medium">TikTok-Shop-Link</label>
            <input id="up-link" type="url" inputMode="url" placeholder="https://vm.tiktok.com/…" value={link} onChange={(e) => setLink(e.target.value)} className={inputCls} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="up-price" className="text-sm font-medium">Einkaufspreis</label>
            <div className="relative">
              <input id="up-price" inputMode="decimal" placeholder="27,90" value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-invalid={priceText.trim() !== "" && purchase == null} className={`${inputCls} pr-10 tabular`} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle">€</span>
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="up-video" className="text-sm font-medium">TikTok-Video-Link <span className="font-normal text-fg-subtle">(optional)</span></label>
            <input id="up-video" type="url" inputMode="url" placeholder="https://www.tiktok.com/@…/video/…" value={video} onChange={(e) => setVideo(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid content-start gap-4">
          <TierList purchase={purchase} rate={creator.statusCode} value={tierId} onChange={setTierId} name="up-tier" />
          <div className="flex items-end justify-between gap-4 rounded-xl bg-white/[0.03] px-4 py-3">
            <span className="text-sm text-fg-muted">Echter Verlust nach Steuer</span>
            <AnimatedEuro value={o?.loss ?? null} className="text-2xl font-semibold tracking-tight text-neon" />
          </div>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button type="submit" disabled={busy} className="justify-self-start">{busy ? "Wird hochgeladen …" : "Sample hochladen"}</Button>
        </div>
      </form>
    </details>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8" aria-busy="true" aria-label="Wird geladen">
      <div className="h-12 w-72 animate-pulse rounded-xl bg-white/[0.05]" />
      <div className="mt-10 grid grid-cols-3 gap-6">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      <div className="mt-12 grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-card bg-white/[0.04]" />)}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowSquareOut, CaretDown, MagnifyingGlass, Package, Plus, Receipt, TelegramLogo, X } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TierList } from "@/components/pricing/TierList";
import { addSample, telegramBotLink, today, updateSample, type Sample, type SampleStatus } from "@/lib/api";
import { TIERS, fmtEUR, parseMoney, taxBack, tierPrice, type TierId } from "@/lib/pricing";
import { fmtDate } from "@/lib/invoice";
import { useDashboard } from "./DashboardShell";
import { PageHead, inputCls } from "./ui";

type Filter = "alle" | SampleStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "verfuegbar", label: "Verfügbar" },
  { id: "verkauft", label: "Verkauft" },
];

const statusOf = (s: Sample): SampleStatus => s.status ?? "verfuegbar";
const tierIdOf = (label: string): TierId => TIERS.find((t) => t.label === label)?.id ?? "fair";
const imageSrc = (img?: string) => (!img ? "" : /^https:\/\//.test(img) ? img : "/" + img.replace(/^assets\//, ""));

export function SamplesView() {
  const { samples, samplesError, creator, creds } = useDashboard();
  const [filter, setFilter] = useState<Filter>("alle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (samples ?? []).filter((s) => (filter === "alle" || statusOf(s) === filter) && (!q || (s.name || "").toLowerCase().includes(q)));
  }, [samples, filter, query]);

  const sold = (samples ?? []).filter((s) => statusOf(s) === "verkauft");
  const revenue = sold.reduce((sum, s) => sum + (s.soldPrice ?? s.price), 0);
  const rate = creator.statusCode;
  const viaTax = rate == null ? null : sold.reduce((sum, s) => sum + taxBack(s.purchasePrice ?? 0, s.soldPrice ?? s.price, rate), 0);

  return (
    <div>
      <PageHead
        title="Samples"
        text="Alles, was du über Telegram oder hier hochgeladen hast. Markiere verkaufte Samples, dann landen sie in deiner Steuer-Übersicht."
        actions={
          <>
            <a href={telegramBotLink(creds.userId)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              <TelegramLogo size={16} weight="fill" /> Telegram-Bot
            </a>
            <Button type="button" onClick={() => setUpload((v) => !v)} aria-expanded={upload}>
              {upload ? <X size={16} /> : <Plus size={16} />} {upload ? "Schließen" : "Sample hochladen"}
            </Button>
          </>
        }
      />

      <AnimatePresence initial={false}>{upload ? <WebUpload key="up" onDone={() => setUpload(false)} /> : null}</AnimatePresence>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {[
          { k: "Samples", v: samples ? String(samples.length) : "-" },
          { k: "Verfügbar", v: samples ? String(samples.length - sold.length) : "-" },
          { k: "Erlöse", v: samples ? fmtEUR(revenue) : "-" },
          { k: "Über die Steuer", v: samples && viaTax != null ? `+ ${fmtEUR(viaTax)}` : "-" },
        ].map((m) => (
          <div key={m.k} className="border-t border-white/[0.12] pt-3">
            <dt className="text-sm text-fg-muted">{m.k}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular">{m.v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Filter" className="flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`h-8 rounded-full px-4 text-sm font-medium transition-colors ${filter === f.id ? "bg-neon text-neon-ink" : "text-fg-muted hover:text-fg"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Samples durchsuchen</span>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" className={`${inputCls} h-10 pl-10 text-sm`} />
        </label>
      </div>

      <div className="mt-4">
        {samples === null ? (
          <div className="grid gap-2" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
        ) : samplesError ? (
          <Notice tone="error">{samplesError}</Notice>
        ) : samples.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-white/12 px-6 py-10">
            <Package size={32} weight="light" className="text-fg-subtle" aria-hidden="true" />
            <p className="max-w-[46ch] text-fg-muted">Noch keine Samples. Schick dem Telegram-Bot einen TikTok-Shop-Link oder lade hier im Browser hoch.</p>
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] px-5 py-8 text-center text-fg-muted">Keine Samples für diesen Filter.</p>
        ) : (
          <ul className="grid gap-2">
            {list.map((s) => (
              <SampleRow key={s.id} sample={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SampleRow({ sample: s, open, onToggle }: { sample: Sample; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const src = imageSrc(s.image);
  const isSold = statusOf(s) === "verkauft";
  const shown = isSold ? s.soldPrice ?? s.price : s.price;

  return (
    <li className={`overflow-hidden rounded-xl border transition-colors ${open ? "border-white/20 bg-ink-900" : "border-white/[0.08] bg-ink-900/60 hover:border-white/20"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-3 text-left sm:p-4">
        <span className="grid size-12 place-items-center overflow-hidden rounded-lg bg-white/[0.05]">
          {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : <Package size={20} className="text-fg-subtle" aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{s.name || "TikTok Shop Produkt"}</span>
          <span className="mt-0.5 block truncate text-sm text-fg-muted">
            Einkauf {fmtEUR(s.purchasePrice ?? NaN)}
            {s.tier ? `, ${s.tier}` : ""}
            {s.createdAt ? `, ${fmtDate(s.createdAt.slice(0, 10))}` : ""}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-right">
            <span className="block text-lg font-semibold tracking-tight tabular">{fmtEUR(shown)}</span>
            <span className={`block text-xs ${isSold ? "text-neon" : "text-fg-subtle"}`}>{isSold ? `Verkauft ${s.soldAt ? fmtDate(s.soldAt) : ""}` : "Verfügbar"}</span>
          </span>
          <CaretDown size={16} className={`text-fg-subtle transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="detail"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <SampleDetail sample={s} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function SampleDetail({ sample: s }: { sample: Sample }) {
  const { creds, creator, patchSample } = useDashboard();
  const isSold = statusOf(s) === "verkauft";
  const [priceText, setPriceText] = useState(() => String(s.price).replace(".", ","));
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (change: Parameters<typeof updateSample>[2]) => {
    setBusy(true);
    setError("");
    try {
      const res = await updateSample(creds, s.id, change);
      patchSample(s.id, res.sample);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sellPrice = parseMoney(priceText);
  const sellOk = Number.isFinite(sellPrice) && sellPrice >= 0;
  const purchase = s.purchasePrice ?? 0;

  function markSold(e: FormEvent) {
    e.preventDefault();
    if (!sellOk) return setError("Bitte gib den Verkaufspreis als Zahl ein, z. B. 18,90.");
    run({ status: "verkauft", soldPrice: sellPrice, soldAt: date });
  }

  return (
    <div className="grid gap-6 border-t border-white/[0.08] p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        {isSold ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fg-muted">Verkauft für</dt>
            <dd className="text-right font-medium tabular">{fmtEUR(s.soldPrice ?? s.price)}</dd>
            <dt className="text-fg-muted">Einkaufspreis</dt>
            <dd className="text-right tabular">{fmtEUR(purchase)}</dd>
            {creator.statusCode != null ? (
              <>
                <dt className="text-fg-muted">Später über die Steuer</dt>
                <dd className="text-right font-medium text-neon tabular">+ {fmtEUR(taxBack(purchase, s.soldPrice ?? s.price, creator.statusCode))}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <div>
            <p className="text-sm font-medium">Preisstufe</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TIERS.map((t) => {
                const active = tierIdOf(s.tier) === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() => !active && run({ tier: t.id })}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${active ? "border-neon/70 bg-neon/[0.06]" : "border-white/[0.09] hover:border-white/25"}`}
                  >
                    <span className={`block text-sm font-medium ${active ? "text-neon" : ""}`}>{t.label}</span>
                    <span className="block text-xs text-fg-muted tabular">{fmtEUR(tierPrice(purchase, t.id))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {s.shopLink ? <ExtLink href={s.shopLink}>TikTok Shop</ExtLink> : null}
          {s.videoLink ? <ExtLink href={s.videoLink}>Video</ExtLink> : null}
          {s.source ? <span className="text-fg-subtle">Hochgeladen via {s.source}</span> : null}
        </div>
      </div>

      <div className="grid content-start gap-3">
        {isSold ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/steuer/rechnungen?sample=${encodeURIComponent(s.id)}`} className={buttonClass("primary")}>
              <Receipt size={16} /> Rechnung erstellen
            </Link>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => run({ status: "verfuegbar" })}>
              Wieder verfügbar
            </Button>
          </div>
        ) : (
          <form onSubmit={markSold} noValidate className="grid gap-3 rounded-xl bg-white/[0.03] p-4">
            <p className="text-sm font-medium">Als verkauft markieren</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-fg-muted">Verkaufspreis</span>
                <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-invalid={!sellOk} className={`${inputCls} h-11 tabular`} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-fg-muted">Verkauft am</span>
                <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={`${inputCls} h-11`} />
              </label>
            </div>
            <Button type="submit" disabled={busy} className="justify-self-start">{busy ? "Wird gespeichert …" : "Verkauft"}</Button>
          </form>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-fg-muted underline decoration-white/20 underline-offset-4 hover:text-fg hover:decoration-neon">
      {children} <ArrowSquareOut size={14} aria-hidden="true" />
    </a>
  );
}

function WebUpload({ onDone }: { onDone: () => void }) {
  const { creds, creator, reloadSamples } = useDashboard();
  const reduce = useReducedMotion();
  const [link, setLink] = useState("");
  const [priceText, setPriceText] = useState("");
  const [video, setVideo] = useState("");
  const [tierId, setTierId] = useState<TierId>("fair");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const p = parseMoney(priceText);
  const purchase = Number.isFinite(p) && p > 0 && p <= 100000 ? p : null;
  const urlOk = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems = [!urlOk(link) && "TikTok-Shop-Link", purchase == null && "Einkaufspreis", video.trim() && !urlOk(video) && "Video-Link"].filter(Boolean);
    if (problems.length) return setError(`Bitte prüfe: ${problems.join(", ")}.`);
    setBusy(true);
    setError("");
    try {
      await addSample(creds, { shopLink: link.trim(), price: purchase!, tier: tierId, videoLink: video.trim() || undefined });
      await reloadSamples();
      onDone();
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.form
      onSubmit={submit}
      noValidate
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mt-6 grid gap-8 rounded-card border border-white/[0.08] bg-ink-900 p-5 sm:p-6 lg:grid-cols-2"
    >
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
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" disabled={busy} className="justify-self-start">{busy ? "Wird hochgeladen …" : "Sample hochladen"}</Button>
      </div>
    </motion.form>
  );
}

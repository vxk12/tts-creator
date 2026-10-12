"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FilePlus, Plus, Printer, Receipt, Trash, X } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { createInvoice, listInvoices, today, type Invoice, type InvoiceRecipient, type Sample } from "@/lib/api";
import { fmtEUR, fmtPct, parseMoney } from "@/lib/pricing";
import { VAT_RATES, fmtDate, invoiceTotals } from "@/lib/invoice";
import { useDashboard } from "../DashboardShell";
import { PageHead, inputCls } from "../ui";

interface Line {
  key: number;
  description: string;
  qty: string;
  price: string;
  sampleId?: string;
}

let lineKey = 0;
const newLine = (l: Partial<Line> = {}): Line => ({ key: ++lineKey, description: "", qty: "1", price: "", ...l });
const money = (n: number) => n.toFixed(2).replace(".", ",");

export function InvoicesView() {
  const { creds, taxProfile, samples } = useDashboard();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Sample | true | null>(null);
  const [preview, setPreview] = useState<Invoice | null>(null);

  useEffect(() => {
    listInvoices(creds).then(setInvoices).catch((e: Error) => { setError(e.message); setInvoices([]); });
  }, [creds]);

  // Aus dem Sample-Bereich: /dashboard/steuer/rechnungen?sample=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("sample");
    const s = id && samples?.find((x) => x.id === id);
    if (s) {
      setEditing(s);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [samples]);

  return (
    <div>
      <PageHead
        title="Rechnungen"
        text="Rechnungen für verkaufte Samples oder Kooperationen. Nummern werden automatisch fortlaufend vergeben."
        actions={!editing && taxProfile ? <Button type="button" onClick={() => setEditing(true)}><FilePlus size={16} /> Neue Rechnung</Button> : null}
      />

      {!taxProfile ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-card border border-dashed border-white/12 px-6 py-8">
          <Receipt size={32} weight="light" className="text-fg-subtle" aria-hidden="true" />
          <p className="max-w-[52ch] text-fg-muted">Bevor du die erste Rechnung schreibst, brauchen wir deine Rechnungsdaten: Name, Anschrift und Steuernummer.</p>
          <Link href="/dashboard/steuer/daten" className={buttonClass("primary")}>Rechnungsdaten eintragen</Link>
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {editing && taxProfile ? (
          <InvoiceEditor
            key="editor"
            from={editing === true ? null : editing}
            onCancel={() => setEditing(null)}
            onCreated={(inv) => { setInvoices((l) => [inv, ...(l ?? [])]); setEditing(null); setPreview(inv); }}
          />
        ) : null}
      </AnimatePresence>

      <div className="mt-8">
        {invoices === null ? (
          <div className="grid gap-2" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : invoices.length === 0 ? (
          taxProfile && !editing ? <p className="rounded-xl border border-white/[0.08] px-5 py-8 text-center text-fg-muted">Noch keine Rechnungen.</p> : null
        ) : (
          <ul className="grid gap-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => setPreview(inv)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-white/[0.08] bg-ink-900/60 p-4 text-left transition-colors hover:border-white/20"
                >
                  <span className="font-mono text-sm text-neon">{inv.number}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{inv.recipient.name}</span>
                    <span className="block text-sm text-fg-muted">{fmtDate(inv.date)}</span>
                  </span>
                  <span className="text-lg font-semibold tracking-tight tabular">{fmtEUR(inv.gross)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>{preview ? <PreviewModal key="preview" invoice={preview} onClose={() => setPreview(null)} /> : null}</AnimatePresence>
    </div>
  );
}

function InvoiceEditor({ from, onCancel, onCreated }: { from: Sample | null; onCancel: () => void; onCreated: (inv: Invoice) => void }) {
  const { creds, taxProfile, samples } = useDashboard();
  const reduce = useReducedMotion();
  const small = taxProfile!.smallBusiness;
  const [vatRate, setVatRate] = useState<number>(small ? 0 : 0.19);
  const [recipient, setRecipient] = useState<InvoiceRecipient>({ name: "", street: "", zip: "", city: "" });
  const [date, setDate] = useState(today());
  const [serviceDate, setServiceDate] = useState(from?.soldAt || today());
  const [lines, setLines] = useState<Line[]>(() => [from ? sampleLine(from, small ? 0 : 0.19) : newLine()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sold = (samples ?? []).filter((s) => s.status === "verkauft" && !lines.some((l) => l.sampleId === s.id));
  const parsed = lines.map((l) => ({ description: l.description.trim(), qty: Number(l.qty), unitPrice: parseMoney(l.price) }));
  const valid = parsed.every((it) => it.description && Number.isInteger(it.qty) && it.qty >= 1 && it.qty <= 999 && Number.isFinite(it.unitPrice) && it.unitPrice >= 0);
  const totals = invoiceTotals(parsed.map((it) => ({ ...it, unitPrice: Number.isFinite(it.unitPrice) ? it.unitPrice : 0, qty: it.qty || 0 })), vatRate);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const setR = (k: keyof InvoiceRecipient) => (e: { target: { value: string } }) => setRecipient({ ...recipient, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!recipient.name.trim() || !recipient.street.trim() || !recipient.zip.trim() || !recipient.city.trim()) {
      return setError("Bitte gib Name und vollständige Anschrift des Empfängers an.");
    }
    if (!valid) return setError("Bitte prüfe die Positionen: Beschreibung, Menge (1 bis 999) und Preis als Zahl.");
    setBusy(true);
    setError("");
    try {
      const res = await createInvoice(creds, {
        date, serviceDate, recipient, vatRate,
        items: parsed,
        sampleIds: lines.map((l) => l.sampleId).filter((x): x is string => !!x),
      });
      onCreated(res.invoice);
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
      className="mt-8 rounded-card border border-white/[0.08] bg-ink-900 p-5 sm:p-7"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Neue Rechnung</h2>
        <button type="button" onClick={onCancel} aria-label="Abbrechen" className="grid size-9 place-items-center rounded-full text-fg-muted hover:text-fg"><X size={18} /></button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <fieldset className="grid content-start gap-3">
          <legend className="mb-1 text-sm font-medium">Empfänger</legend>
          <input aria-label="Name oder Firma" placeholder="Name oder Firma" value={recipient.name} onChange={setR("name")} className={inputCls} />
          <input aria-label="Straße und Hausnummer" placeholder="Straße und Hausnummer" value={recipient.street} onChange={setR("street")} className={inputCls} />
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <input aria-label="PLZ" placeholder="PLZ" value={recipient.zip} onChange={setR("zip")} className={inputCls} />
            <input aria-label="Ort" placeholder="Ort" value={recipient.city} onChange={setR("city")} className={inputCls} />
          </div>
        </fieldset>
        <div className="grid content-start gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Rechnungsdatum</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Leistungsdatum</span>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
            </label>
          </div>
          {small ? (
            <Notice>Kleinunternehmer: Die Rechnung enthält keine Umsatzsteuer, sondern den Hinweis nach § 19 UStG.</Notice>
          ) : (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Umsatzsteuer</span>
              <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className={inputCls}>
                {VAT_RATES.filter((r) => r > 0).map((r) => <option key={r} value={r}>{fmtPct(r)}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium">Positionen {small ? "" : <span className="font-normal text-fg-subtle">(Preise netto)</span>}</p>
        <div className="mt-2 grid gap-2">
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_auto]">
              <input aria-label={`Beschreibung Position ${i + 1}`} placeholder="Beschreibung" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} className={`${inputCls} col-span-3 h-11 sm:col-span-1`} />
              <input aria-label={`Menge Position ${i + 1}`} inputMode="numeric" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className={`${inputCls} h-11 text-center tabular`} />
              <input aria-label={`Einzelpreis Position ${i + 1}`} inputMode="decimal" placeholder="0,00" value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} className={`${inputCls} h-11 text-right tabular`} />
              <button
                type="button"
                aria-label={`Position ${i + 1} entfernen`}
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className="grid size-11 place-items-center rounded-xl text-fg-subtle hover:text-danger disabled:opacity-30"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-sm text-fg-muted hover:text-fg">
            <Plus size={14} /> Position
          </button>
          {sold.slice(0, 6).map((s) => (
            <button key={s.id} type="button" onClick={() => setLines((ls) => [...ls.filter((x) => x.description || x.price), sampleLine(s, vatRate)])} className="inline-flex h-9 max-w-[16rem] items-center gap-1.5 rounded-full border border-neon/30 px-3.5 text-sm text-neon hover:border-neon/70">
              <Plus size={14} /> <span className="truncate">{s.name || "Sample"}</span>
            </button>
          ))}
        </div>
      </div>

      <dl className="ml-auto mt-8 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
        {!small ? (
          <>
            <dt className="text-fg-muted">Netto</dt><dd className="text-right tabular">{fmtEUR(totals.net)}</dd>
            <dt className="text-fg-muted">USt {fmtPct(vatRate)}</dt><dd className="text-right tabular">{fmtEUR(totals.vat)}</dd>
          </>
        ) : null}
        <div className="col-span-2 mt-1 border-t border-white/[0.08]" aria-hidden="true" />
        <dt className="pt-1 font-medium">Gesamt</dt>
        <dd className="pt-1 text-right text-xl font-semibold tracking-tight text-neon tabular">{fmtEUR(totals.gross)}</dd>
      </dl>

      {error ? <div className="mt-6"><Notice tone="error">{error}</Notice></div> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={busy}>{busy ? "Wird erstellt …" : "Rechnung erstellen"}</Button>
      </div>
    </motion.form>
  );
}

/** Position aus einem verkauften Sample. Verkaufspreis ist brutto, bei Regelbesteuerung wird netto eingetragen. */
function sampleLine(s: Sample, vatRate: number): Line {
  const gross = s.soldPrice ?? s.price;
  return newLine({ description: s.name || "TikTok Shop Produkt (Sample)", price: money(Math.round((gross / (1 + vatRate)) * 100) / 100), sampleId: s.id });
}

function PreviewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Rechnung ${invoice.number}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-ink-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="mx-auto max-w-[52rem] px-4 py-6 sm:py-10" onClick={(e) => e.stopPropagation()}>
        <div className="print-hidden mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">Rechnung {invoice.number}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => window.print()}><Printer size={16} /> Drucken oder als PDF</Button>
            <Button type="button" variant="secondary" onClick={onClose}><X size={16} /> Schließen</Button>
          </div>
        </div>
        <motion.div initial={reduce ? false : { y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <InvoiceDocument invoice={invoice} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Die Rechnung als Papier (hell, auch für den Druck). Pflichtangaben nach § 14 UStG. */
function InvoiceDocument({ invoice: inv }: { invoice: Invoice }) {
  const s = inv.sender;
  return (
    <article className="print-doc rounded-card bg-[#fbfbf9] p-8 text-[13px] leading-relaxed text-[#1c1f1d] shadow-[0_24px_80px_rgb(0_0_0/0.45)] sm:p-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-base font-semibold">{s.name}</p>
          <p className="text-[#5b625d]">{s.street}<br />{s.zip} {s.city}{s.email ? <><br />{s.email}</> : null}</p>
        </div>
        <p className="text-3xl font-semibold tracking-tight">Rechnung</p>
      </header>

      <div className="mt-10 flex flex-wrap justify-between gap-8">
        <div>
          <p className="text-[11px] text-[#7a817c]">{s.name}, {s.street}, {s.zip} {s.city}</p>
          <p className="mt-2 font-medium">{inv.recipient.name}</p>
          <p>{inv.recipient.street}<br />{inv.recipient.zip} {inv.recipient.city}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
          <dt className="text-[#5b625d]">Rechnungsnummer</dt><dd className="text-right font-medium">{inv.number}</dd>
          <dt className="text-[#5b625d]">Rechnungsdatum</dt><dd className="text-right">{fmtDate(inv.date)}</dd>
          <dt className="text-[#5b625d]">Leistungsdatum</dt><dd className="text-right">{fmtDate(inv.serviceDate)}</dd>
          {s.taxNumber ? <><dt className="text-[#5b625d]">Steuernummer</dt><dd className="text-right">{s.taxNumber}</dd></> : null}
          {s.vatId ? <><dt className="text-[#5b625d]">USt-IdNr.</dt><dd className="text-right">{s.vatId}</dd></> : null}
        </dl>
      </div>

      <table className="mt-10 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#1c1f1d]/20 text-[#5b625d]">
            <th className="py-2 pr-3 font-medium">Pos.</th>
            <th className="py-2 pr-3 font-medium">Beschreibung</th>
            <th className="py-2 pr-3 text-right font-medium">Menge</th>
            <th className="py-2 pr-3 text-right font-medium">Einzelpreis</th>
            <th className="py-2 text-right font-medium">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i} className="border-b border-[#1c1f1d]/10 align-top">
              <td className="py-2.5 pr-3">{i + 1}</td>
              <td className="py-2.5 pr-3">{it.description}</td>
              <td className="py-2.5 pr-3 text-right tabular">{it.qty}</td>
              <td className="py-2.5 pr-3 text-right tabular">{fmtEUR(it.unitPrice)}</td>
              <td className="py-2.5 text-right tabular">{fmtEUR(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 grid max-w-[18rem] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
        {!inv.smallBusiness ? (
          <>
            <dt className="text-[#5b625d]">Nettobetrag</dt><dd className="text-right tabular">{fmtEUR(inv.net)}</dd>
            <dt className="text-[#5b625d]">Umsatzsteuer {fmtPct(inv.vatRate)}</dt><dd className="text-right tabular">{fmtEUR(inv.vat)}</dd>
          </>
        ) : null}
        <div className="col-span-2 mt-1 border-t border-[#1c1f1d]/20" aria-hidden="true" />
        <dt className="pt-1 font-semibold">Gesamtbetrag</dt>
        <dd className="pt-1 text-right font-semibold tabular">{fmtEUR(inv.gross)}</dd>
      </dl>

      <footer className="mt-12 grid gap-2 text-[#5b625d]">
        {inv.smallBusiness ? <p>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p> : null}
        {s.iban ? <p>Bitte überweise den Gesamtbetrag auf folgendes Konto: IBAN {s.iban.replace(/(.{4})/g, "$1 ").trim()}</p> : null}
        <p>Vielen Dank!</p>
      </footer>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DownloadSimple, FilePlus, IdentificationCard } from "@phosphor-icons/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { listInvoices, type Invoice } from "@/lib/api";
import { fmtEUR, fmtPct, realLoss } from "@/lib/pricing";
import { downloadCsv, fmtDate } from "@/lib/invoice";
import { useDashboard } from "../DashboardShell";
import { PageHead } from "../ui";

// Allgemeine Hinweise, bewusst vorsichtig formuliert (keine Steuerberatung)
const HINTS = [
  { t: "Gewerbe", d: "Wer regelmäßig Provisionen verdient, braucht in der Regel eine Gewerbeanmeldung." },
  { t: "Provisionen", d: "Die Abrechnungen aus dem TikTok Shop Creator Center gehören zu deinen Einnahmen und in deine Unterlagen." },
  { t: "Samples", d: "Samples und ihr Weiterverkauf können steuerlich relevant sein. Halte Wert, Verkaufspreis und Datum fest, das übernimmt der Sample-Bereich." },
  { t: "Umsatzsteuer", d: "Mit der Kleinunternehmerregelung (§ 19 UStG) weist du keine Umsatzsteuer aus. Einstellbar unter Steuerdaten." },
  { t: "Aufbewahren", d: "Rechnungen und Belege musst du mehrere Jahre aufbewahren, in der Regel 8 bis 10 Jahre." },
];

export function TaxOverview() {
  const { creds, creator, samples, taxProfile } = useDashboard();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  useEffect(() => {
    listInvoices(creds).then(setInvoices).catch((e: Error) => { setError(e.message); setInvoices([]); });
  }, [creds]);

  const years = useMemo(() => {
    const ys = new Set([thisYear]);
    samples?.forEach((s) => s.createdAt && ys.add(Number(s.createdAt.slice(0, 4))));
    invoices?.forEach((i) => ys.add(Number(i.date.slice(0, 4))));
    return [...ys].filter(Boolean).sort((a, b) => b - a);
  }, [samples, invoices, thisYear]);

  const inYear = (d?: string | null) => !!d && d.startsWith(String(year));
  const received = (samples ?? []).filter((s) => inYear(s.createdAt));
  const sold = (samples ?? []).filter((s) => s.status === "verkauft" && inYear(s.soldAt));
  const yearInvoices = (invoices ?? []).filter((i) => inYear(i.date));
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

  const value = sum(received.map((s) => s.purchasePrice ?? 0));
  const revenue = sum(sold.map((s) => s.soldPrice ?? s.price));
  const loss = sum(sold.map((s) => realLoss(s.purchasePrice ?? 0, s.soldPrice ?? s.price, creator.statusCode)));
  const invGross = sum(yearInvoices.map((i) => i.gross));
  const invVat = sum(yearInvoices.map((i) => i.vat));

  function exportSamples() {
    downloadCsv(`Samples ${year}.csv`,
      ["Name", "Hochgeladen am", "Einkaufspreis", "Preisstufe", "Status", "Verkauft am", "Verkaufspreis", "Echter Verlust nach Steuer"],
      (samples ?? []).filter((s) => inYear(s.createdAt) || inYear(s.soldAt)).map((s) => {
        const isSold = s.status === "verkauft";
        const sale = s.soldPrice ?? s.price;
        return [
          s.name || "TikTok Shop Produkt", s.createdAt ? fmtDate(s.createdAt.slice(0, 10)) : "", s.purchasePrice ?? 0, s.tier,
          isSold ? "Verkauft" : "Verfügbar", isSold && s.soldAt ? fmtDate(s.soldAt) : "", isSold ? sale : "",
          isSold ? realLoss(s.purchasePrice ?? 0, sale, creator.statusCode) : "",
        ];
      }));
  }

  function exportInvoices() {
    downloadCsv(`Rechnungen ${year}.csv`,
      ["Rechnungsnummer", "Rechnungsdatum", "Leistungsdatum", "Empfänger", "Netto", "USt-Satz", "USt", "Brutto"],
      yearInvoices.slice().reverse().map((i) => [i.number, fmtDate(i.date), fmtDate(i.serviceDate), i.recipient.name, i.net, fmtPct(i.vatRate), i.vat, i.gross]));
  }

  const tiles = [
    { k: "Samples erhalten", v: fmtEUR(value), sub: `${n(received.length, "Sample", "Samples")}, Warenwert` },
    { k: "Verkaufserlöse", v: fmtEUR(revenue), sub: `${sold.length} verkauft` },
    { k: "Echter Verlust nach Steuer", v: fmtEUR(loss), sub: `bei ${fmtPct(creator.statusCode)} Steuersatz`, accent: true },
    { k: "Rechnungen", v: fmtEUR(invGross), sub: invoices ? `${n(yearInvoices.length, "Rechnung", "Rechnungen")}, davon USt ${fmtEUR(invVat)}` : "wird geladen" },
  ];

  return (
    <div>
      <PageHead
        title="Steuer"
        text="Deine Zahlen pro Jahr, Rechnungen und Exporte für die Steuererklärung oder deinen Steuerberater."
        actions={<Link href="/dashboard/steuer/rechnungen" className={buttonClass("primary")}><FilePlus size={16} /> Rechnung erstellen</Link>}
      />

      <div role="radiogroup" aria-label="Jahr" className="mt-8 flex flex-wrap gap-2">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            role="radio"
            aria-checked={y === year}
            onClick={() => setYear(y)}
            className={`h-9 rounded-full px-4 text-sm font-medium tabular transition-colors ${y === year ? "bg-neon text-neon-ink" : "border border-white/10 text-fg-muted hover:text-fg"}`}
          >
            {y}
          </button>
        ))}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.k} className={`rounded-card border p-5 sm:p-6 ${t.accent ? "border-neon/30 bg-neon/[0.05]" : "border-white/[0.07] bg-ink-900"}`}>
            <dt className="text-sm text-fg-muted">{t.k}</dt>
            <dd className={`mt-2 text-3xl font-semibold tracking-tight tabular ${t.accent ? "text-neon" : ""}`}>{samples ? t.v : "-"}</dd>
            <dd className="mt-1 text-sm text-fg-subtle">{t.sub}</dd>
          </div>
        ))}
      </dl>
      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mt-10 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section aria-labelledby="export-title" className="rounded-card border border-white/[0.07] bg-ink-900 p-6">
          <h2 id="export-title" className="text-lg font-semibold tracking-tight">Export {year}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">CSV-Dateien für Excel, deine Einnahmen-Überschuss-Rechnung oder den Steuerberater.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={exportSamples} disabled={!samples}><DownloadSimple size={16} /> Samples</Button>
            <Button type="button" variant="secondary" onClick={exportInvoices} disabled={!invoices}><DownloadSimple size={16} /> Rechnungen</Button>
          </div>
          {!taxProfile ? (
            <Link href="/dashboard/steuer/daten" className="mt-6 flex items-center gap-3 rounded-xl bg-white/[0.03] p-4 text-sm text-fg-muted transition-colors hover:text-fg">
              <IdentificationCard size={20} className="shrink-0 text-neon" aria-hidden="true" />
              Für Rechnungen fehlen noch deine Rechnungsdaten.
            </Link>
          ) : null}
        </section>

        <section aria-labelledby="hints-title" className="rounded-card border border-white/[0.07] bg-ink-900 p-6">
          <h2 id="hints-title" className="text-lg font-semibold tracking-tight">Steuern als TikTok Shop Affiliate</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            {HINTS.map((h) => (
              <div key={h.t}>
                <dt className="font-medium">{h.t}</dt>
                <dd className="mt-1 leading-relaxed text-fg-muted">{h.d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-fg-subtle">Allgemeine Hinweise, keine Steuerberatung. Für deinen Fall sprich mit einem Steuerberater.</p>
        </section>
      </div>
    </div>
  );
}

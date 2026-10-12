/**
 * Rechnungsbeträge in ganzen Cent, genau wie createInvoice_ in backend/Code.gs.
 * Positionen werden netto erfasst; Kleinunternehmer (§ 19 UStG) haben Steuersatz 0.
 */

export const VAT_RATES = [0.19, 0.07, 0] as const;

export function invoiceTotals(items: { description: string; qty: number; unitPrice: number }[], vatRate: number) {
  const lines = items.map((it) => {
    const unitCents = Math.round(it.unitPrice * 100);
    return { ...it, unitPrice: unitCents / 100, total: (it.qty * unitCents) / 100, cents: it.qty * unitCents };
  });
  const netCents = lines.reduce((sum, l) => sum + l.cents, 0);
  const vatCents = Math.round(netCents * vatRate);
  return {
    items: lines.map(({ cents: _c, ...l }) => l),
    net: netCents / 100,
    vat: vatCents / 100,
    gross: (netCents + vatCents) / 100,
  };
}

/** yyyy-mm-dd → 12.10.2026 */
export const fmtDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

/** Zeitstempel (ISO, UTC) → lokales Datum 13.10.2026 */
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** CSV für Excel (Semikolon, deutsches Dezimalkomma) als Download. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

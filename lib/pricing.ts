/**
 * Preislogik der Plattform.
 *
 * Steuersatz (Status_Code, Spalte C): kommt aus dem Onboarding.
 * Preisvorschläge (vorläufig): Verkaufspreis = Einkaufspreis × Faktor der Stufe. Alternativ ein eigener Preis.
 * Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz).
 * Angezeigt wird das Positive: Zurück nach Steuer = Einkaufspreis − echter Verlust = Verkaufspreis + Steuervorteil.
 *
 * Muss zu bot/pricing.py und CONFIG.TIERS in backend/Code.gs passen.
 * Gerechnet wird in ganzen Cent bzw. Basispunkten, damit Website und Bot (Python/Decimal)
 * cent-genau gleich kaufmännisch runden.
 */

export type TierId = "fair" | "schnell" | "sofort";
/** Vorschlag (Stufe) oder eigener Preis */
export type PriceChoice = TierId | "eigen";
export const CUSTOM_LABEL = "Eigener Preis";

export interface Tier {
  id: TierId;
  label: string;
  factor: number;
  hint: string;
}

export const TIERS: readonly Tier[] = [
  { id: "fair", label: "Fair", factor: 0.7, hint: "Guter Preis, etwas Geduld" },
  { id: "schnell", label: "Schnell", factor: 0.55, hint: "Geht meist zügig weg" },
  { id: "sofort", label: "Sofort weg", factor: 0.4, hint: "Für den schnellen Abverkauf" },
] as const;

export interface Bracket {
  label: string;
  code: number;
}

/** Einkommens-Abfrage, falls der Grenzsteuersatz unbekannt ist. */
export const BRACKETS: readonly Bracket[] = [
  { label: "Unter 12.300 € pro Jahr", code: 0 },
  { label: "15.000 bis 60.000 € pro Jahr", code: 0.3 },
  { label: "Über 66.000 € pro Jahr", code: 0.42 },
] as const;

export const MAX_RATE_PERCENT = 60;

const toCents = (eur: number) => Math.round(eur * 100);
const toBp = (factor: number) => Math.round(factor * 10000);
const mulCents = (cents: number, bp: number) => Math.round((cents * bp) / 10000);

export function tier(id: TierId | string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

/** Verkaufspreis der Stufe = Einkaufspreis × Faktor */
export function tierPrice(purchase: number, id: TierId | string): number {
  return mulCents(toCents(purchase), toBp(tier(id).factor)) / 100;
}

/** Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz) */
export function realLoss(purchase: number, price: number, rate: number): number {
  return mulCents(toCents(purchase) - toCents(price), 10000 - toBp(rate)) / 100;
}

/** Zurück nach Steuer = Einkaufspreis − echter Verlust (= Verkaufspreis + Steuervorteil) */
export function payback(purchase: number, price: number, rate: number): number {
  return (toCents(purchase) - toCents(realLoss(purchase, price, rate))) / 100;
}

/** Was später über die Steuer kommt (Steuervorteil), bei beliebigem Verkaufspreis. Negativ, wenn über Einkaufspreis verkauft. */
export function taxBack(purchase: number, price: number, rate: number): number {
  return (toCents(payback(purchase, price, rate)) - toCents(price)) / 100;
}

export interface Offer {
  tier: Tier;
  purchase: number;
  price: number;
  diff: number;
  rate: number;
  taxSaving: number;
  loss: number;
  /** Zurück nach Steuer */
  back: number;
  /** Anteil vom Einkaufspreis, der zurückkommt (0 bis 1) */
  backShare: number;
}

export function offer(purchase: number, id: TierId | string, rate: number): Offer {
  const t = tier(id);
  const price = tierPrice(purchase, t.id);
  const diff = (toCents(purchase) - toCents(price)) / 100;
  const loss = realLoss(purchase, price, rate);
  return {
    tier: t,
    purchase: toCents(purchase) / 100,
    price,
    diff,
    rate,
    taxSaving: (toCents(diff) - toCents(loss)) / 100,
    loss,
    back: (toCents(purchase) - toCents(loss)) / 100,
    backShare: toCents(purchase) > 0 ? (toCents(purchase) - toCents(loss)) / toCents(purchase) : 0,
  };
}

/** "27,90" | "27.90" | "27 €" | "1.299,00" → Zahl (oder NaN) */
export function parseMoney(value: string | number | null | undefined): number {
  const s = String(value ?? "").replace(/\s|€/g, "");
  if (!s) return NaN;
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  return /^\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
}

/** Prozent-Eingabe ("35" oder "35,5") → Dezimal-Steuersatz (0.35) oder null */
export function parseRatePercent(value: string): number | null {
  const raw = value.trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_RATE_PERCENT) return null;
  return Math.round(n * 100) / 10000;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const fmtEUR = (n: number) => (Number.isFinite(n) ? eur.format(n) : "-");
export const fmtPct = (rate: number) => `${(rate * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
/** Für einen beliebigen Verkaufspreis (Vorschlag oder eigener Preis): was sofort und was später über die Steuer kommt.
 *  Über Einkaufspreis gibt es keinen Steuervorteil (taxSaving = 0). */
export function priceOffer(purchase: number, price: number, rate: number) {
  const taxSaving = Math.max(0, taxBack(purchase, price, rate));
  return {
    purchase: toCents(purchase) / 100,
    price: toCents(price) / 100,
    diff: (toCents(purchase) - toCents(price)) / 100,
    taxSaving,
    back: (toCents(price) + toCents(taxSaving)) / 100,
  };
}

/** Verkaufspreis zur Auswahl: Vorschlag oder gültiger eigener Preis (sonst null). */
export function chosenPrice(purchase: number, choice: PriceChoice, customText: string): number | null {
  if (choice !== "eigen") return tierPrice(purchase, choice);
  const p = parseMoney(customText);
  return p > 0 && p <= 100000 ? p : null;
}

/** Steuersatz anzeigen; null = noch nicht festgelegt */
export const fmtRate = (rate: number | null) => (rate == null ? "nicht festgelegt" : fmtPct(rate));

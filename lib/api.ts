/**
 * Anbindung an das Backend (Google Apps Script, siehe backend/Code.gs).
 * Ohne API_URL läuft alles im Demo-Modus: Daten liegen nur im localStorage dieses Browsers.
 */
import { API_URL, DEMO, TELEGRAM_BOT } from "./config";
import { CUSTOM_LABEL, tierPrice, tier as tierOf, type PriceChoice, type TierId } from "./pricing";
import { invoiceTotals } from "./invoice";

export interface Creator {
  userId: string;
  /** Steuersatz als Dezimalzahl; null = noch nicht festgelegt (optional seit der Upload-Fokussierung) */
  statusCode: number | null;
  telegram: string;
}

export interface Credentials {
  userId: string;
  creatorKey: string;
}

export interface Sample {
  id: string;
  userId: string;
  name: string;
  price: number;
  purchasePrice: number | null;
  originalPrice: number | null;
  tier: string;
  source: string;
  image?: string;
  shopLink?: string;
  videoLink?: string;
  createdAt: string | null;
  status?: SampleStatus;
  soldAt?: string;
  soldPrice?: number | null;
}

export type SampleStatus = "verfuegbar" | "verkauft";

export interface SampleUpdate {
  tier?: PriceChoice;
  /** nur bei tier "eigen" */
  salePrice?: number;
  status?: SampleStatus;
  soldPrice?: number;
  soldAt?: string; // yyyy-mm-dd
}

/** Absender auf Rechnungen (Steuer → Steuerdaten). */
export interface TaxProfile {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  taxNumber: string;
  vatId: string;
  iban: string;
  smallBusiness: boolean;
}

export interface InvoiceRecipient {
  name: string;
  street: string;
  zip: string;
  city: string;
}

export interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  serviceDate: string;
  recipient: InvoiceRecipient;
  items: InvoiceItem[];
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
  smallBusiness: boolean;
  sender: TaxProfile;
  sampleIds: string[];
  createdAt: string;
}

export interface NewInvoice {
  date: string;
  serviceDate: string;
  recipient: InvoiceRecipient;
  items: { description: string; qty: number; unitPrice: number }[];
  vatRate: number;
  sampleIds: string[];
}

export interface NewSample {
  shopLink: string;
  price: number;
  tier: PriceChoice;
  /** Verkaufspreis, nur bei tier "eigen" */
  salePrice?: number;
  videoLink?: string;
  name?: string;
  description?: string;
  category?: string;
}

/* ---------- Speicher (robust, falls localStorage blockiert ist) ---------- */
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignorieren */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorieren */
    }
  },
};

export const session = {
  get: () => store.get<Credentials | null>("tts_session", null),
  set: (c: Credentials) => store.set("tts_session", c),
  clear: () => store.remove("tts_session"),
};

const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Deep-Link zum Bot: start=<Base64url(TikTok-Username)>. Der Bot fragt dann nur noch den Creator-Key ab. */
export const telegramBotLink = (userId?: string) =>
  `https://t.me/${TELEGRAM_BOT}` + (userId ? `?start=${b64url(userId)}` : "");

export const USER_RE = /^[A-Za-z0-9._]{2,24}$/;
export const normalizeUser = (v: string) => v.trim().replace(/^@+/, "");

/* ---------- Live-API ---------- */
type ApiResponse<T> = T & { ok: boolean; error?: string };

async function apiGet<T>(action: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`);
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.ok) throw new Error(data.error || "Unbekannter Fehler");
  return data;
}

async function apiPost<T>(payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  // text/plain vermeidet einen CORS-Preflight, den Apps Script nicht beantwortet
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.ok) throw new Error(data.error || "Unbekannter Fehler");
  return data;
}

/* ---------- Demo-Modus ---------- */
interface DemoCreator extends Creator {
  creatorKey: string;
  taxProfile?: TaxProfile | null;
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const demo = {
  creators: () => store.get<Record<string, DemoCreator>>("tts_demo_creators", {}),
  samples: () => store.get<Sample[]>("tts_demo_samples", []),
  find(userId: string) {
    const all = demo.creators();
    const key = Object.keys(all).find((k) => k.toLowerCase() === userId.toLowerCase());
    return key ? all[key] : null;
  },
  save(c: DemoCreator) {
    const all = demo.creators();
    all[c.userId] = c;
    store.set("tts_demo_creators", all);
  },
  auth(creds: Credentials) {
    const c = demo.find(normalizeUser(creds.userId));
    if (!c || c.creatorKey !== creds.creatorKey.trim()) {
      throw new Error("Login fehlgeschlagen. Username oder Creator-Key ist falsch.");
    }
    return c;
  },
};
const publicCreator = (c: DemoCreator): Creator => ({ userId: c.userId, statusCode: c.statusCode, telegram: c.telegram });

/* ---------- Öffentliche Funktionen ---------- */
export async function register(input: { isShopCreator: boolean; userId: string; statusCode: number | null }) {
  if (!DEMO) return apiPost<{ creator: Creator; creatorKey: string }>({ action: "register", ...input });
  await delay(450);
  if (!input.isShopCreator) throw new Error("Die Plattform ist nur für offizielle TikTok Shop Creator.");
  const userId = normalizeUser(input.userId);
  if (demo.find(userId)) throw new Error("Dieser TikTok-Username ist bereits registriert. Bitte logge dich im Dashboard ein.");
  const creatorKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const c: DemoCreator = { userId, statusCode: input.statusCode, telegram: "", creatorKey };
  demo.save(c);
  return { ok: true, creator: publicCreator(c), creatorKey };
}

export async function login(creds: Credentials) {
  if (!DEMO) return apiPost<{ creator: Creator; taxProfile?: TaxProfile | null }>({ action: "login", ...creds });
  await delay(300);
  const c = demo.auth(creds);
  return { ok: true, creator: publicCreator(c), taxProfile: c.taxProfile ?? null };
}

export async function updateStatus(creds: Credentials, statusCode: number) {
  if (!DEMO) return apiPost<{ creator: Creator }>({ action: "updateStatus", ...creds, statusCode });
  await delay(300);
  const c = demo.auth(creds);
  c.statusCode = statusCode;
  demo.save(c);
  return { ok: true, creator: publicCreator(c) };
}

export async function addSample(creds: Credentials, s: NewSample) {
  if (!DEMO) {
    return apiPost<{ product: { id: string; price: number | null } }>({ action: "addProduct", ...creds, ...s, source: "web" });
  }
  await delay(450);
  const c = demo.auth(creds);
  const sample: Sample = {
    id: "local-" + Date.now(),
    userId: c.userId,
    name: s.name || "",
    price: s.tier === "eigen" ? s.salePrice ?? 0 : tierPrice(s.price, s.tier),
    purchasePrice: s.price,
    originalPrice: s.price,
    tier: s.tier === "eigen" ? CUSTOM_LABEL : tierOf(s.tier).label,
    source: "Web",
    createdAt: new Date().toISOString(),
  };
  store.set("tts_demo_samples", [sample, ...demo.samples()]);
  return { ok: true, product: { id: sample.id, price: sample.price } };
}

export async function getSamples(userId: string): Promise<Sample[]> {
  const all = DEMO ? demo.samples() : (await apiGet<{ products: Sample[] }>("products")).products;
  return all.filter((p) => (p.userId || "").toLowerCase() === userId.toLowerCase());
}

/** Neuer Backend-Stand nötig? (alte Apps-Script-Version kennt die Aktion nicht) */
const outdated = (e: unknown) =>
  e instanceof Error && e.message === "Unbekannte Aktion."
    ? new Error("Das Backend ist noch nicht aktualisiert. Bitte den neuen Apps-Script-Code bereitstellen (siehe README).")
    : e;

async function apiPostNew<T>(payload: Record<string, unknown>) {
  try {
    return await apiPost<T>(payload);
  } catch (e) {
    throw outdated(e);
  }
}

export async function updateSample(creds: Credentials, id: string, change: SampleUpdate) {
  if (!DEMO) return apiPostNew<{ sample: Partial<Sample> & { id: string } }>({ action: "updateSample", ...creds, id, ...change });
  await delay(300);
  demo.auth(creds);
  const all = demo.samples();
  const s = all.find((x) => x.id === id);
  if (!s) throw new Error("Sample nicht gefunden.");
  if (change.tier === "eigen") Object.assign(s, { tier: CUSTOM_LABEL, price: change.salePrice ?? s.price });
  else if (change.tier) Object.assign(s, { tier: tierOf(change.tier).label, price: tierPrice(s.purchasePrice ?? 0, change.tier) });
  if (change.status === "verkauft") Object.assign(s, { status: "verkauft", soldAt: change.soldAt ?? today(), soldPrice: change.soldPrice ?? s.price });
  if (change.status === "verfuegbar") Object.assign(s, { status: "verfuegbar", soldAt: "", soldPrice: null });
  store.set("tts_demo_samples", all);
  return { ok: true, sample: s };
}

export async function updateTaxProfile(creds: Credentials, taxProfile: TaxProfile) {
  if (!DEMO) return apiPostNew<{ taxProfile: TaxProfile }>({ action: "updateTaxProfile", ...creds, taxProfile });
  await delay(300);
  if (!taxProfile.taxNumber && !taxProfile.vatId) throw new Error("Bitte gib deine Steuernummer oder USt-IdNr. an (Pflicht auf Rechnungen).");
  const c = demo.auth(creds);
  c.taxProfile = taxProfile;
  demo.save(c);
  return { ok: true, taxProfile };
}

export async function listInvoices(creds: Credentials): Promise<Invoice[]> {
  if (!DEMO) return (await apiPostNew<{ invoices: Invoice[] }>({ action: "listInvoices", ...creds })).invoices;
  await delay(250);
  const c = demo.auth(creds);
  return demoInvoices().filter((i) => i.sender && i.id.startsWith(c.userId + ":")).reverse();
}

export async function createInvoice(creds: Credentials, input: NewInvoice) {
  if (!DEMO) return apiPostNew<{ invoice: Invoice }>({ action: "createInvoice", ...creds, ...input });
  await delay(400);
  const c = demo.auth(creds);
  if (!c.taxProfile) throw new Error("Bitte hinterlege zuerst deine Rechnungsdaten (Steuer → Steuerdaten).");
  const all = demoInvoices();
  const year = input.date.slice(0, 4);
  const count = all.filter((i) => i.id.startsWith(c.userId + ":") && i.number.startsWith(year)).length;
  const vatRate = c.taxProfile.smallBusiness ? 0 : input.vatRate;
  const t = invoiceTotals(input.items, vatRate);
  const invoice: Invoice = {
    id: `${c.userId}:${Date.now()}`,
    number: `${year}-${String(count + 1).padStart(3, "0")}`,
    date: input.date,
    serviceDate: input.serviceDate,
    recipient: input.recipient,
    items: t.items,
    net: t.net,
    vatRate,
    vat: t.vat,
    gross: t.gross,
    smallBusiness: c.taxProfile.smallBusiness,
    sender: c.taxProfile,
    sampleIds: input.sampleIds,
    createdAt: new Date().toISOString(),
  };
  store.set("tts_demo_invoices", [...all, invoice]);
  return { ok: true, invoice };
}

const demoInvoices = () => store.get<Invoice[]>("tts_demo_invoices", []);

/** Heutiges Datum als yyyy-mm-dd (lokale Zeit). */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

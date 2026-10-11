/**
 * Anbindung an das Backend (Google Apps Script, siehe backend/Code.gs).
 * Ohne API_URL läuft alles im Demo-Modus: Daten liegen nur im localStorage dieses Browsers.
 */
import { API_URL, DEMO, TELEGRAM_BOT } from "./config";
import { tierPrice, tier as tierOf, type TierId } from "./pricing";

export interface Creator {
  userId: string;
  statusCode: number;
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
  createdAt: string | null;
}

export interface NewSample {
  shopLink: string;
  price: number;
  tier: TierId;
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
export async function register(input: { isShopCreator: boolean; userId: string; statusCode: number }) {
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
  if (!DEMO) return apiPost<{ creator: Creator }>({ action: "login", ...creds });
  await delay(300);
  return { ok: true, creator: publicCreator(demo.auth(creds)) };
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
    price: tierPrice(s.price, s.tier),
    purchasePrice: s.price,
    originalPrice: s.price,
    tier: tierOf(s.tier).label,
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

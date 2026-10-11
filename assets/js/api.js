/* Gemeinsame Helfer + API-Anbindung (Google Apps Script). Ohne API_URL läuft alles im Demo-Modus. */
(function () {
  const cfg = window.TTS_CONFIG || {};
  const DEMO = !cfg.API_URL;
  const CATEGORIES = ['Tech', 'Beauty', 'Haushalt', 'Sonstiges'];

  /* ---------- Speicher (robust, falls localStorage blockiert ist) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignorieren */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (_) { /* ignorieren */ }
    },
  };

  const session = {
    get: () => store.get('tts_session', null),
    set: (s) => store.set('tts_session', s),
    clear: () => store.remove('tts_session'),
  };

  /* ---------- Formatierung & Sicherheit ---------- */
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmtEUR = (n) => (typeof n === 'number' && isFinite(n) ? eur.format(n) : '–');

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

  const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /** Link zum Telegram-Bot; start-Parameter = Base64url(TikTok-Username). */
  const telegramBotLink = (userId) =>
    `https://t.me/${cfg.TELEGRAM_BOT}` + (userId ? `?start=${b64url(userId)}` : '');

  /** Kaufen-Link: privater Chat des Creators, sonst Bot mit Produkt-Referenz. */
  const buyLink = (p) => {
    if (p.telegram) return `https://t.me/${encodeURIComponent(p.telegram)}`;
    const ref = String(p.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 58);
    return `https://t.me/${cfg.TELEGRAM_BOT}?start=kauf_${ref}`;
  };

  /* ---------- Preislogik ----------
     Steuersatz (Status_Code, Spalte C): kommt aus dem Onboarding und bestimmt den echten Verlust.
     Preisstufen (vorläufig): Verkaufspreis = Einkaufspreis × Faktor der Stufe.
     Muss zu bot/pricing.py und CONFIG.TIERS in backend/Code.gs passen.                    */
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  // Ganzzahl-Arithmetik, damit Website und Bot (Python/Decimal) cent-genau gleich runden
  const toCents = (eur) => Math.round(eur * 100);
  const toBp = (factor) => Math.round(factor * 10000);
  const mulCents = (cents, bp) => Math.round((cents * bp) / 10000);
  const PRICING = {
    MAX_RATE_PERCENT: 60,
    BRACKETS: [
      { label: 'Unter 12.300 €', sub: 'pro Jahr', code: 0.0 },
      { label: '15.000 € – 60.000 €', sub: 'pro Jahr', code: 0.3 },
      { label: 'Über 66.000 €', sub: 'pro Jahr', code: 0.42 },
    ],
    TIERS: [
      { id: 'fair', label: 'Fair', factor: 0.7, emoji: '🟢' },
      { id: 'schnell', label: 'Schnell', factor: 0.55, emoji: '🟡' },
      { id: 'sofort', label: 'Sofort weg', factor: 0.4, emoji: '🔴' },
    ],
    tier(id) { return PRICING.TIERS.find((t) => t.id === id) || PRICING.TIERS[0]; },
    /** Verkaufspreis der Stufe = Einkaufspreis × Faktor (exakt in Cent, kaufmännisch gerundet) */
    tierPrice(purchase, tierId) { return mulCents(toCents(purchase), toBp(PRICING.tier(tierId).factor)) / 100; },
    /** Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz) */
    realLoss(purchase, price, rate) { return mulCents(toCents(purchase) - toCents(price), 10000 - toBp(rate)) / 100; },
    offer(purchase, tierId, rate) {
      const t = PRICING.tier(tierId);
      const price = PRICING.tierPrice(purchase, t.id);
      const diff = round2(purchase - price);
      const loss = PRICING.realLoss(purchase, price, rate);
      return { tier: t, purchase: round2(purchase), price, diff, rate, taxSaving: round2(diff - loss), loss };
    },
    /** "27,90" / "27.90" / "27 €" → 27.9 (oder NaN) */
    parseMoney(v) {
      const s = String(v == null ? '' : v).replace(/\s|€/g, '');
      if (!s) return NaN;
      const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
      return /^\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
    },
  };
  const pct = (rate) => (rate * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';
  const salePrice = (purchase, rate) => round2(purchase * (rate === 0 ? 0.82 : 1 - rate)); // nur Demo-Beispieldaten

  /* ---------- Live-API ---------- */
  async function apiGet(action) {
    const res = await fetch(`${cfg.API_URL}?action=${encodeURIComponent(action)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler');
    return data;
  }

  async function apiPost(payload) {
    // text/plain vermeidet einen CORS-Preflight, den Apps Script nicht beantwortet
    const res = await fetch(cfg.API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler');
    return data;
  }

  /* ---------- Demo-Modus (nur im Browser gespeichert) ---------- */
  const DAY = 86400000;
  const DEMO_PRODUCTS = [
    { id: 'demo-1', userId: 'techtina', name: 'Kabellose In-Ear-Kopfhörer mit Ladecase', originalPrice: 79.99, category: 'Tech', rate: 0.3, image: 'assets/img/p-earbuds.webp', age: 0,
      description: 'True-Wireless-Kopfhörer mit Noise-Cancelling und kompaktem Ladecase. Einmal für ein Review-Video ausgepackt, danach wieder sauber verpackt. Ladekabel und Ersatz-Aufsätze liegen bei.' },
    { id: 'demo-2', userId: 'glowbylena', name: 'Gesichtsmassagegerät mit Mikrostrom', originalPrice: 189.0, category: 'Beauty', rate: 0.42, image: 'assets/img/p-beauty-device.webp', age: 1,
      description: 'Mikrostrom-Gerät für die Gesichtspflege. Nur für das Testvideo kurz eingeschaltet, Schutzfolien teilweise noch drauf. Inklusive Ladestation und Originalkarton.' },
    { id: 'demo-3', userId: 'homehacks.max', name: 'Tragbarer Akku-Mixer to go', originalPrice: 34.9, category: 'Haushalt', rate: 0, image: 'assets/img/p-mixer.webp', age: 2,
      description: 'Kabelloser Mini-Mixer für Shakes und Smoothies unterwegs. Einmal im Video gezeigt und gereinigt, voll funktionsfähig.' },
    { id: 'demo-4', userId: 'techtina', name: 'Powerbank 10.000 mAh mit USB-C', originalPrice: 34.99, category: 'Tech', rate: 0.3, image: 'assets/img/p-powerbank.webp', age: 3,
      description: 'Kompakte Powerbank mit USB-C Power Delivery. Nur fürs Unboxing ausgepackt, nie im Alltag genutzt.' },
    { id: 'demo-5', userId: 'glowbylena', name: 'Gesichtsserum 3er-Set', originalPrice: 39.5, category: 'Beauty', rate: 0.42, image: 'assets/img/p-serum.webp', age: 4,
      description: 'Drei Seren im Set. Für das Video geöffnet und gezeigt, Füllstand nahezu voll.' },
    { id: 'demo-6', userId: 'glowbylena', name: 'Make-up Starter-Set mit Lidschatten-Palette', originalPrice: 49.0, category: 'Beauty', rate: 0.3, image: 'assets/img/p-makeup.webp', age: 5,
      description: 'Starter-Set mit Lidschatten-Palette, Foundation und Pinseln. Für einen Swatch im Video kurz verwendet.' },
    { id: 'demo-7', userId: 'gadgetguru', name: 'Smartwatch mit AMOLED-Display', originalPrice: 99.0, category: 'Tech', rate: 0.42, image: 'assets/img/p-watch.webp', age: 6,
      description: 'Smartwatch mit AMOLED-Display, Pulsmessung und Schlaftracking. Für das Review eingerichtet und auf Werkseinstellungen zurückgesetzt.' },
    { id: 'demo-8', userId: 'gadgetguru', name: 'Schreibtisch-Set mit kabellosem Ladepad', originalPrice: 59.0, category: 'Sonstiges', rate: 0.3, image: 'assets/img/cat-sonstiges.webp', age: 7,
      description: 'Ordnungs-Set für den Schreibtisch mit integriertem Qi-Ladepad.' },
  ].map(({ age, ...p }) => ({
    ...p,
    price: salePrice(p.originalPrice, p.rate),
    videoLink: 'https://www.tiktok.com/',
    telegram: '',
    createdAt: new Date(Date.now() - (age + 1) * DAY).toISOString(),
  }));

  const demo = {
    creators: () => store.get('tts_demo_creators', {}),
    products: () => store.get('tts_demo_products', []),
    find(userId) {
      const all = demo.creators();
      const key = Object.keys(all).find((k) => k.toLowerCase() === String(userId).toLowerCase());
      return key ? all[key] : null;
    },
    save(creator) {
      const all = demo.creators();
      all[creator.userId] = creator;
      store.set('tts_demo_creators', all);
    },
    auth({ userId, creatorKey }) {
      const c = demo.find(String(userId || '').replace(/^@+/, '').trim());
      if (!c || c.creatorKey !== String(creatorKey || '').trim()) {
        throw new Error('Login fehlgeschlagen. Username oder Creator-Key ist falsch.');
      }
      return c;
    },
  };

  const sessionStore = {
    get() {
      try {
        const c = JSON.parse(sessionStorage.getItem('tts_products'));
        return c && Date.now() - c.t < 60000 ? c.data : null;
      } catch (_) { return null; }
    },
    set(data) { try { sessionStorage.setItem('tts_products', JSON.stringify({ t: Date.now(), data })); } catch (_) { /* ignorieren */ } },
    clear() { try { sessionStorage.removeItem('tts_products'); } catch (_) { /* ignorieren */ } },
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Öffentliche Funktionen ---------- */
  async function getProducts() {
    if (!DEMO) {
      // Kurzzeit-Cache, damit der Wechsel zwischen Seiten sofort geht
      const cached = sessionStore.get();
      if (cached) return cached;
      const products = (await apiGet('products')).products;
      sessionStore.set(products);
      return products;
    }
    await delay(350);
    return [...demo.products().slice().reverse(), ...DEMO_PRODUCTS];
  }

  async function register({ isShopCreator, userId, statusCode }) {
    if (!DEMO) return apiPost({ action: 'register', isShopCreator, userId, statusCode });
    await delay(400);
    if (isShopCreator !== true) throw new Error('Die Plattform ist nur für offizielle TikTok Shop Creator.');
    const id = String(userId).replace(/^@+/, '').trim();
    if (demo.find(id)) throw new Error('Dieser TikTok-Username ist bereits registriert. Bitte logge dich im Dashboard ein.');
    const creatorKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const creator = { userId: id, statusCode, telegram: '', creatorKey };
    demo.save(creator);
    return { ok: true, creator: { userId: id, statusCode, telegram: '' }, creatorKey };
  }

  async function login(creds) {
    if (!DEMO) return apiPost({ action: 'login', ...creds });
    await delay(300);
    const c = demo.auth(creds);
    return { ok: true, creator: { userId: c.userId, statusCode: c.statusCode, telegram: c.telegram } };
  }

  async function addProduct(creds, product) {
    if (!DEMO) { sessionStore.clear(); return apiPost({ action: 'addProduct', ...creds, ...product }); }
    await delay(500);
    const c = demo.auth(creds);
    const purchase = PRICING.parseMoney(product.price);
    const p = {
      id: 'local-' + Date.now(),
      userId: c.userId,
      name: product.name || '',
      description: product.description || '',
      createdAt: new Date().toISOString(),
      originalPrice: purchase,
      price: PRICING.tierPrice(purchase, product.tier),
      purchasePrice: purchase,
      tier: PRICING.tier(product.tier).label,
      source: 'Web',
      videoLink: product.videoLink,
      category: CATEGORIES.includes(product.category) ? product.category : 'Sonstiges',
      telegram: c.telegram,
    };
    store.set('tts_demo_products', [...demo.products(), p]);
    return { ok: true, product: p };
  }

  async function updateStatus(creds, statusCode) {
    if (!DEMO) return apiPost({ action: 'updateStatus', ...creds, statusCode });
    await delay(300);
    const c = demo.auth(creds);
    c.statusCode = statusCode;
    demo.save(c);
    return { ok: true, creator: { userId: c.userId, statusCode: c.statusCode, telegram: c.telegram } };
  }

  async function updateProfile(creds, telegram) {
    if (!DEMO) return apiPost({ action: 'updateProfile', ...creds, telegram });
    await delay(300);
    const c = demo.auth(creds);
    c.telegram = String(telegram || '').replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '').replace(/^@+/, '').trim();
    demo.save(c);
    return { ok: true, creator: { userId: c.userId, statusCode: c.statusCode, telegram: c.telegram } };
  }

  /* Demo-Hinweis einblenden */
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('demoBanner');
    if (banner && DEMO) banner.hidden = false;
  });

  window.TTS = {
    DEMO, CATEGORIES, PRICING, pct, session, fmtEUR, esc, safeUrl, telegramBotLink, buyLink,
    getProducts, register, login, addProduct, updateProfile, updateStatus,
  };
})();

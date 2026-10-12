/**
 * TTS Creator-Plattform – Backend (Google Apps Script)
 *
 * Einrichtung (siehe README.md):
 *   Google Sheet öffnen → Erweiterungen → Apps Script → diesen Code einfügen
 *   → einmal `setup` ausführen → Bereitstellen → Neue Bereitstellung → Web-App
 *     (Ausführen als: Ich, Zugriff: Jeder) → Web-App-URL in assets/js/config.js eintragen.
 */

const CONFIG = {
  PRODUCTS_SHEET: 'Tabellenblatt1',
  CREATORS_SHEET: 'Creators',
  INVOICES_SHEET: 'Rechnungen',
  // Formel für Spalte H (Verkaufspreis) = Einkaufspreis (F) × Preisfaktor der gewählten Stufe (N).
  // {r} wird durch die Zeilennummer ersetzt.
  PRICE_FORMULA: '=IF(OR(F{r}="",N{r}=""),"",ROUND(F{r}*N{r},2))',
  // Preisstufen (vorläufig) – müssen zu bot/pricing.py und PRICING.TIERS in assets/js/api.js passen.
  TIERS: {
    fair: { label: 'Fair', factor: 0.70 },
    schnell: { label: 'Schnell', factor: 0.55 },
    sofort: { label: 'Sofort weg', factor: 0.40 },
  },
  CATEGORIES: ['Tech', 'Beauty', 'Haushalt', 'Sonstiges'],
  THUMB_CACHE_SECONDS: 21600, // 6 Stunden
  VAT_RATES: [0, 0.07, 0.19],
  // Eigener Preis statt Vorschlag: Verkaufspreis steht dann als Wert in Spalte H (keine Formel, kein Faktor)
  CUSTOM_TIER: { id: 'eigen', label: 'Eigener Preis' },
  SALE_STATUS: { verfuegbar: 'Verfügbar', verkauft: 'Verkauft' },
};

// Spalten im Produkt-Blatt (1-basiert)
const P = {
  ID: 1, USER: 2, STATUS: 3, NAME: 4, SHOP: 5, PRICE: 6, VIDEO: 7, SALE: 8, TAX: 9, CAT: 10, CREATED: 11, DESC: 12,
  TIER: 13, FACTOR: 14, SOURCE: 15, IMAGE: 16, SHOP_PRICE: 17, SALE_STATUS: 18, SOLD_AT: 19, SOLD_PRICE: 20,
};
const P_HEADERS = ['Produkt_ID', 'User_ID', 'Status_Code', 'Produkt_Name', 'TTS_Shop_Link', 'Einkaufspreis',
  'TikTok_Video_Link', 'Empfohlener_Verkaufspreis', 'Tax_Rate', 'Kategorie', 'Erstellt_Am', 'Beschreibung',
  'Preisstufe', 'Preisfaktor', 'Quelle', 'Bild_URL', 'Shop_Preis', 'Verkaufsstatus', 'Verkauft_Am', 'Verkauft_Fuer'];

// Spalten im Creator-Blatt (1-basiert) – B = User_ID, C = Status_Code wie in der Spezifikation
const C = { CREATED: 1, USER: 2, STATUS: 3, TELEGRAM: 4, KEY_HASH: 5, PROFILE: 6 };
const C_HEADERS = ['Registriert_Am', 'User_ID', 'Status_Code', 'Telegram_Username', 'Creator_Key_Hash', 'Rechnungsdaten'];

// Spalten im Rechnungs-Blatt (1-basiert). Rechnungen werden nie gelöscht (Aufbewahrungspflicht).
const I = {
  ID: 1, USER: 2, NUMBER: 3, DATE: 4, SERVICE_DATE: 5, RECIPIENT: 6, ITEMS: 7, NET: 8, VAT_RATE: 9, VAT: 10,
  GROSS: 11, SMALL_BUSINESS: 12, SENDER: 13, CREATED: 14, SAMPLE_IDS: 15,
};
const I_HEADERS = ['Rechnungs_ID', 'User_ID', 'Rechnungsnummer', 'Rechnungsdatum', 'Leistungsdatum', 'Empfaenger',
  'Positionen', 'Netto', 'USt_Satz', 'USt', 'Brutto', 'Kleinunternehmer', 'Absender', 'Erstellt_Am', 'Sample_IDs'];

/* ------------------------------------------------------------------ */
/* HTTP-Einstiegspunkte                                                */
/* ------------------------------------------------------------------ */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'products';
  try {
    if (action === 'products') return json_({ ok: true, products: listProducts_() });
    return json_({ ok: false, error: 'Unbekannte Aktion.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return json_({ ok: false, error: 'Ungültige Anfrage.' });
  }
  try {
    switch (body.action) {
      case 'register': return json_(register_(body));
      case 'login': return json_(login_(body));
      case 'addProduct': return json_(addProduct_(body));
      case 'updateProfile': return json_(updateProfile_(body));
      case 'updateStatus': return json_(updateStatus_(body));
      case 'updateSample': return json_(updateSample_(body));
      case 'updateTaxProfile': return json_(updateTaxProfile_(body));
      case 'listInvoices': return json_(listInvoices_(body));
      case 'createInvoice': return json_(createInvoice_(body));
      default: return json_({ ok: false, error: 'Unbekannte Aktion.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/** Einmal manuell ausführen: legt das Creator-Blatt und fehlende Spaltenköpfe an. */
function setup() {
  ensureSheets_();
}

/* ------------------------------------------------------------------ */
/* Aktionen                                                            */
/* ------------------------------------------------------------------ */

function register_(body) {
  if (body.isShopCreator !== true) {
    throw new Error('Die Plattform ist nur für offizielle TikTok Shop Creator.');
  }
  const userId = normalizeUser_(body.userId);
  // Steuersatz ist optional (null = noch nicht festgelegt, nicht dasselbe wie 0 %)
  const statusCode = body.statusCode === null || body.statusCode === undefined || body.statusCode === '' ? null : parseRate_(body.statusCode);

  return withLock_(() => {
    const sheet = creatorsSheet_();
    if (findCreator_(userId)) {
      throw new Error('Dieser TikTok-Username ist bereits registriert. Bitte logge dich im Dashboard ein.');
    }
    const creatorKey = Utilities.getUuid().replace(/-/g, '');
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, C_HEADERS.length)
      .setValues([[new Date(), userId, statusCode === null ? '' : statusCode, '', hash_(creatorKey)]]);
    return { ok: true, creator: { userId: userId, statusCode: statusCode, telegram: '' }, creatorKey: creatorKey };
  });
}

function login_(body) {
  const creator = auth_(body);
  return { ok: true, creator: publicCreator_(creator), taxProfile: creator.taxProfile };
}

function addProduct_(body) {
  const creator = auth_(body);
  const shopLink = parseUrl_(body.shopLink, 'TikTok Shop Produkt-Link');
  const videoLink = body.videoLink ? parseUrl_(body.videoLink, 'TikTok-Video-Link') : '';
  const tierId = String(body.tier || '');
  const custom = tierId === CONFIG.CUSTOM_TIER.id;
  const tier = custom ? { label: CONFIG.CUSTOM_TIER.label, factor: '' } : CONFIG.TIERS[tierId];
  if (!tier) throw new Error('Bitte wähle eine Preisstufe oder gib einen eigenen Preis ein.');
  const salePrice = custom ? parseSalePrice_(body.salePrice) : null;
  const price = Number(String(body.price || '').replace(',', '.'));
  if (!isFinite(price) || price <= 0 || price > 100000) {
    throw new Error('Bitte gib den Einkaufspreis als Zahl ein (z. B. 27.90).');
  }
  const name = String(body.name || '').trim().slice(0, 120);
  const category = CONFIG.CATEGORIES.indexOf(body.category) >= 0 ? body.category : '';
  const description = String(body.description || '').trim().slice(0, 1500);
  const image = /^(https:\/\/\S+|(assets\/)?img\/[\w\/.-]+)$/.test(String(body.image || '')) ? String(body.image) : '';
  const shopPrice = Number(body.shopPrice);
  const source = body.source === 'telegram' ? 'Telegram' : 'Web';

  return withLock_(() => {
    const sheet = productsSheet_();
    const row = sheet.getLastRow() + 1;
    const id = Utilities.getUuid();
    const values = new Array(P_HEADERS.length).fill('');
    values[P.ID - 1] = id;
    values[P.USER - 1] = creator.userId;          // hinterlegte User_ID
    values[P.STATUS - 1] = creator.statusCode === null ? '' : creator.statusCode; // Status_Code (Spalte C)
    values[P.NAME - 1] = name;
    values[P.SHOP - 1] = shopLink;
    values[P.PRICE - 1] = Math.round(price * 100) / 100;
    values[P.VIDEO - 1] = videoLink;
    values[P.TAX - 1] = creator.statusCode === null ? '' : creator.statusCode;    // Tax_Rate (Spalte I)
    values[P.CAT - 1] = category;
    values[P.CREATED - 1] = new Date();
    values[P.DESC - 1] = description;
    values[P.TIER - 1] = tier.label;
    values[P.FACTOR - 1] = tier.factor;
    values[P.SOURCE - 1] = source;
    values[P.IMAGE - 1] = image;
    values[P.SHOP_PRICE - 1] = isFinite(shopPrice) && shopPrice > 0 ? Math.round(shopPrice * 100) / 100 : '';

    sheet.getRange(row, P.ID).setNumberFormat('@');
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
    setSalePrice_(sheet, row, salePrice);
    SpreadsheetApp.flush();

    const sale = sheet.getRange(row, P.SALE).getValue();
    return {
      ok: true,
      product: {
        id: id, row: row, name: name, category: category, tier: tier.label,
        purchasePrice: values[P.PRICE - 1],
        originalPrice: values[P.SHOP_PRICE - 1] || values[P.PRICE - 1],
        price: typeof sale === 'number' ? sale : null,
        videoLink: videoLink,
      },
    };
  });
}

function updateProfile_(body) {
  const creator = auth_(body);
  const telegram = String(body.telegram || '').trim()
    .replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '')
    .replace(/^@+/, '');
  if (telegram && !/^[A-Za-z0-9_]{5,32}$/.test(telegram)) {
    throw new Error('Ungültiger Telegram-Username (5–32 Zeichen, nur Buchstaben, Zahlen, _).');
  }
  creatorsSheet_().getRange(creator.row, C.TELEGRAM).setValue(telegram);
  creator.telegram = telegram;
  return { ok: true, creator: publicCreator_(creator) };
}

/** Steuersatz (Status_Code, Spalte C) nachträglich ändern. */
function updateStatus_(body) {
  const creator = auth_(body);
  const statusCode = parseRate_(body.statusCode);
  creatorsSheet_().getRange(creator.row, C.STATUS).setValue(statusCode);
  creator.statusCode = statusCode;
  return { ok: true, creator: publicCreator_(creator) };
}

/** Sample verwalten: Preisstufe ändern oder als verkauft / wieder verfügbar markieren. Nur eigene Samples. */
function updateSample_(body) {
  const creator = auth_(body);
  const id = String(body.id || '');
  return withLock_(() => {
    const sheet = productsSheet_();
    const row = findProductRow_(sheet, id, creator.userId);
    if (body.tier !== undefined) {
      const custom = String(body.tier) === CONFIG.CUSTOM_TIER.id;
      const tier = custom ? { label: CONFIG.CUSTOM_TIER.label, factor: '' } : CONFIG.TIERS[String(body.tier)];
      if (!tier) throw new Error('Bitte wähle eine Preisstufe oder gib einen eigenen Preis ein.');
      sheet.getRange(row, P.TIER, 1, 2).setValues([[tier.label, tier.factor]]);
      setSalePrice_(sheet, row, custom ? parseSalePrice_(body.salePrice) : null);
    }
    if (body.status === 'verkauft') {
      SpreadsheetApp.flush();
      const fallback = sheet.getRange(row, P.SALE).getValue();
      const soldPrice = body.soldPrice === undefined || body.soldPrice === '' ? fallback : parseMoney_(body.soldPrice, 'Verkaufspreis');
      sheet.getRange(row, P.SOLD_AT).setNumberFormat('@');
      sheet.getRange(row, P.SALE_STATUS, 1, 3)
        .setValues([[CONFIG.SALE_STATUS.verkauft, parseDate_(body.soldAt || today_(), 'Verkaufsdatum'), soldPrice]]);
    } else if (body.status === 'verfuegbar') {
      sheet.getRange(row, P.SALE_STATUS, 1, 3).setValues([[CONFIG.SALE_STATUS.verfuegbar, '', '']]);
    }
    SpreadsheetApp.flush();
    const r = sheet.getRange(row, 1, 1, P_HEADERS.length).getValues()[0];
    return {
      ok: true,
      sample: {
        id: id, tier: String(r[P.TIER - 1] || ''),
        price: typeof r[P.SALE - 1] === 'number' ? r[P.SALE - 1] : null,
        status: r[P.SALE_STATUS - 1] === CONFIG.SALE_STATUS.verkauft ? 'verkauft' : 'verfuegbar',
        soldAt: dateText_(r[P.SOLD_AT - 1]),
        soldPrice: typeof r[P.SOLD_PRICE - 1] === 'number' ? r[P.SOLD_PRICE - 1] : null,
      },
    };
  });
}

/** Rechnungsdaten (Absender auf Rechnungen) speichern. */
function updateTaxProfile_(body) {
  const creator = auth_(body);
  const p = body.taxProfile || {};
  const text = (v, label, max, required) => {
    const s = String(v || '').trim();
    if (required && !s) throw new Error('Bitte fülle aus: ' + label + '.');
    if (s.length > max) throw new Error(label + ' ist zu lang.');
    return s;
  };
  const profile = {
    name: text(p.name, 'Name', 120, true),
    street: text(p.street, 'Straße und Hausnummer', 120, true),
    zip: text(p.zip, 'PLZ', 10, true),
    city: text(p.city, 'Ort', 80, true),
    email: text(p.email, 'E-Mail', 120, false),
    taxNumber: text(p.taxNumber, 'Steuernummer', 30, false),
    vatId: text(p.vatId, 'USt-IdNr.', 20, false),
    iban: text(p.iban, 'IBAN', 34, false).replace(/\s+/g, ''),
    smallBusiness: p.smallBusiness === true,
  };
  if (!profile.taxNumber && !profile.vatId) throw new Error('Bitte gib deine Steuernummer oder USt-IdNr. an (Pflicht auf Rechnungen).');
  creatorsSheet_().getRange(creator.row, C.PROFILE).setValue(JSON.stringify(profile));
  return { ok: true, taxProfile: profile };
}

function listInvoices_(body) {
  const creator = auth_(body);
  return { ok: true, invoices: invoicesOf_(creator.userId).reverse() };
}

/** Rechnung anlegen. Nummer fortlaufend pro Creator und Jahr (2026-001), Beträge werden hier in Cent berechnet. */
function createInvoice_(body) {
  const creator = auth_(body);
  const sender = creator.taxProfile;
  if (!sender || !sender.name || !(sender.taxNumber || sender.vatId)) {
    throw new Error('Bitte hinterlege zuerst deine Rechnungsdaten (Steuer → Steuerdaten).');
  }
  const r = body.recipient || {};
  const recipient = {
    name: String(r.name || '').trim().slice(0, 120),
    street: String(r.street || '').trim().slice(0, 120),
    zip: String(r.zip || '').trim().slice(0, 10),
    city: String(r.city || '').trim().slice(0, 80),
  };
  if (!recipient.name || !recipient.street || !recipient.zip || !recipient.city) {
    throw new Error('Bitte gib Name und vollständige Anschrift des Empfängers an.');
  }
  const date = parseDate_(body.date, 'Rechnungsdatum');
  const serviceDate = parseDate_(body.serviceDate || body.date, 'Leistungsdatum');
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || rawItems.length > 30) throw new Error('Bitte gib 1 bis 30 Positionen an.');
  const items = rawItems.map((it, i) => {
    const description = String(it.description || '').trim().slice(0, 200);
    if (!description) throw new Error('Position ' + (i + 1) + ': Bitte beschreibe die Leistung.');
    const qty = Number(it.qty);
    if (!(qty >= 1 && qty <= 999 && Math.floor(qty) === qty)) throw new Error('Position ' + (i + 1) + ': Menge 1 bis 999.');
    const unitCents = Math.round(parseMoney_(it.unitPrice, 'Einzelpreis') * 100);
    return { description: description, qty: qty, unitPrice: unitCents / 100, total: (qty * unitCents) / 100 };
  });
  const vatRate = sender.smallBusiness ? 0 : Number(body.vatRate);
  if (CONFIG.VAT_RATES.indexOf(vatRate) < 0) throw new Error('Ungültiger Umsatzsteuersatz.');
  const netCents = items.reduce((sum, it) => sum + Math.round(it.total * 100), 0);
  const vatCents = Math.round(netCents * vatRate);
  const sampleIds = (Array.isArray(body.sampleIds) ? body.sampleIds : []).map(String).slice(0, 30);

  return withLock_(() => {
    const sheet = invoicesSheet_();
    const year = date.slice(0, 4);
    const count = invoicesOf_(creator.userId).filter((inv) => inv.number.slice(0, 4) === year).length;
    const invoice = {
      id: Utilities.getUuid(),
      number: year + '-' + ('00' + (count + 1)).slice(-3),
      date: date, serviceDate: serviceDate, recipient: recipient, items: items,
      net: netCents / 100, vatRate: vatRate, vat: vatCents / 100, gross: (netCents + vatCents) / 100,
      smallBusiness: sender.smallBusiness === true, sender: sender, sampleIds: sampleIds,
      createdAt: new Date().toISOString(),
    };
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, I_HEADERS.length).setNumberFormat('@');
    sheet.getRange(row, I.NET, 1, 4).setNumberFormat('0.00');
    sheet.getRange(row, I.GROSS).setNumberFormat('0.00');
    sheet.getRange(row, 1, 1, I_HEADERS.length).setValues([[
      invoice.id, creator.userId, invoice.number, date, serviceDate, JSON.stringify(recipient), JSON.stringify(items),
      invoice.net, vatRate, invoice.vat, invoice.gross, invoice.smallBusiness ? 'JA' : 'NEIN', JSON.stringify(sender),
      invoice.createdAt, sampleIds.join(','),
    ]]);
    return { ok: true, invoice: invoice };
  });
}

/* ------------------------------------------------------------------ */
/* Schaufenster                                                        */
/* ------------------------------------------------------------------ */

function listProducts_() {
  const sheet = productsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2, 1, last - 1, P_HEADERS.length).getValues();

  const telegramByUser = {};
  creatorsData_().forEach((c) => { telegramByUser[c.userId.toLowerCase()] = c.telegram; });

  const products = [];
  rows.forEach((r, i) => {
    const sale = r[P.SALE - 1];
    if (typeof sale !== 'number' || !(sale > 0)) return; // nur Zeilen mit berechnetem Preis
    const userId = String(r[P.USER - 1] || '').trim();
    const original = r[P.PRICE - 1];
    const shopPrice = r[P.SHOP_PRICE - 1];
    const image = String(r[P.IMAGE - 1] || '').trim();
    products.push({
      id: String(r[P.ID - 1] || 'row' + (i + 2)),
      userId: userId,
      name: String(r[P.NAME - 1] || '').trim(),
      description: String(r[P.DESC - 1] || '').trim(),
      shopLink: String(r[P.SHOP - 1] || '').trim(),
      purchasePrice: typeof original === 'number' ? original : null,
      originalPrice: typeof shopPrice === 'number' && shopPrice > 0 ? shopPrice : (typeof original === 'number' ? original : null),
      tier: String(r[P.TIER - 1] || ''),
      source: String(r[P.SOURCE - 1] || ''),
      image: image,
      price: sale,
      videoLink: String(r[P.VIDEO - 1] || '').trim(),
      category: CONFIG.CATEGORIES.indexOf(r[P.CAT - 1]) >= 0 ? r[P.CAT - 1] : 'Sonstiges',
      createdAt: r[P.CREATED - 1] instanceof Date ? r[P.CREATED - 1].toISOString() : null,
      status: r[P.SALE_STATUS - 1] === CONFIG.SALE_STATUS.verkauft ? 'verkauft' : 'verfuegbar',
      soldAt: dateText_(r[P.SOLD_AT - 1]),
      soldPrice: typeof r[P.SOLD_PRICE - 1] === 'number' ? r[P.SOLD_PRICE - 1] : null,
      telegram: telegramByUser[userId.toLowerCase()] || '',
    });
  });

  enrichWithTikTok_(products);
  return products.reverse(); // neueste zuerst
}

/** Holt Vorschaubild + Titel der TikTok-Videos (oEmbed), gecacht. */
function enrichWithTikTok_(products) {
  const cache = CacheService.getScriptCache();
  const links = products.map((p) => p.videoLink).filter((l) => /^https?:\/\//.test(l));
  const unique = links.filter((l, i) => links.indexOf(l) === i);
  const keys = unique.map((l) => 'oe_' + hash_(l).slice(0, 40));
  const cached = keys.length ? cache.getAll(keys) : {};

  const missing = unique.filter((l, i) => cached[keys[i]] === undefined).slice(0, 25);
  if (missing.length) {
    // Kurzlinks (vm.tiktok.com) zuerst auflösen
    const resolved = missing.slice();
    const shortIdx = missing.map((l, i) => (/\/\/(vm|vt)\.tiktok\.com\//.test(l) ? i : -1)).filter((i) => i >= 0);
    if (shortIdx.length) {
      const res = UrlFetchApp.fetchAll(shortIdx.map((i) => ({ url: missing[i], followRedirects: false, muteHttpExceptions: true })));
      res.forEach((r, j) => {
        const loc = r.getHeaders()['Location'] || r.getHeaders()['location'];
        if (loc) resolved[shortIdx[j]] = String(loc).split('?')[0];
      });
    }
    const responses = UrlFetchApp.fetchAll(resolved.map((l) => ({
      url: 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(l), muteHttpExceptions: true,
    })));
    const toCache = {};
    responses.forEach((r, i) => {
      const idFromUrl = (String(resolved[i]).match(/\/video\/(\d+)/) || [])[1] || '';
      let data = { t: '', title: '', id: idFromUrl };
      if (r.getResponseCode() === 200) {
        try {
          const o = JSON.parse(r.getContentText());
          data = { t: o.thumbnail_url || '', title: o.title || '', id: o.embed_product_id || idFromUrl };
        } catch (_) { /* ignorieren */ }
      }
      const key = keys[unique.indexOf(missing[i])];
      toCache[key] = JSON.stringify(data);
      cached[key] = toCache[key];
    });
    cache.putAll(toCache, CONFIG.THUMB_CACHE_SECONDS);
  }

  products.forEach((p) => {
    const idx = unique.indexOf(p.videoLink);
    if (idx < 0 || !cached[keys[idx]]) return;
    try {
      const d = JSON.parse(cached[keys[idx]]);
      p.thumbnail = d.t || '';
      p.videoId = d.id || '';
      if (!p.name && d.title) p.videoTitle = d.title;
    } catch (_) { /* ignorieren */ }
  });
}

/* ------------------------------------------------------------------ */
/* Creator-Hilfsfunktionen                                             */
/* ------------------------------------------------------------------ */

function auth_(body) {
  const userId = normalizeUser_(body.userId);
  const creator = findCreator_(userId);
  if (!creator || !body.creatorKey || hash_(String(body.creatorKey).trim()) !== creator.keyHash) {
    throw new Error('Login fehlgeschlagen. Username oder Creator-Key ist falsch.');
  }
  return creator;
}

function findCreator_(userId) {
  const needle = userId.toLowerCase();
  return creatorsData_().filter((c) => c.userId.toLowerCase() === needle)[0] || null;
}

function creatorsData_() {
  const sheet = creatorsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, C_HEADERS.length).getValues()
    .map((r, i) => ({
      row: i + 2,
      userId: String(r[C.USER - 1] || '').trim(),
      statusCode: r[C.STATUS - 1] === '' ? null : Number(r[C.STATUS - 1]) || 0,
      telegram: String(r[C.TELEGRAM - 1] || '').trim(),
      keyHash: String(r[C.KEY_HASH - 1] || ''),
      taxProfile: parseJson_(r[C.PROFILE - 1], null),
    }))
    .filter((c) => c.userId);
}

function publicCreator_(c) {
  return { userId: c.userId, statusCode: c.statusCode, telegram: c.telegram };
}

/* ------------------------------------------------------------------ */
/* Allgemeine Helfer                                                   */
/* ------------------------------------------------------------------ */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let products = ss.getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!products) products = ss.insertSheet(CONFIG.PRODUCTS_SHEET);
  const head = products.getRange(1, 1, 1, P_HEADERS.length).getValues()[0];
  P_HEADERS.forEach((h, i) => { if (!String(head[i]).trim()) products.getRange(1, i + 1).setValue(h); });

  let creators = ss.getSheetByName(CONFIG.CREATORS_SHEET);
  if (!creators) {
    creators = ss.insertSheet(CONFIG.CREATORS_SHEET);
    creators.getRange(1, 1, 1, C_HEADERS.length).setValues([C_HEADERS]).setFontWeight('bold');
    creators.getRange('B:B').setNumberFormat('@');
    creators.setFrozenRows(1);
  }
  const cHead = creators.getRange(1, 1, 1, C_HEADERS.length).getValues()[0];
  C_HEADERS.forEach((h, i) => { if (!String(cHead[i]).trim()) creators.getRange(1, i + 1).setValue(h); });

  if (!ss.getSheetByName(CONFIG.INVOICES_SHEET)) {
    const inv = ss.insertSheet(CONFIG.INVOICES_SHEET);
    inv.getRange(1, 1, 1, I_HEADERS.length).setValues([I_HEADERS]).setFontWeight('bold');
    inv.setFrozenRows(1);
  }
}

/** Spalte H: eigener Preis als Wert, sonst die Formel Einkaufspreis × Faktor. */
function setSalePrice_(sheet, row, salePrice) {
  const cell = sheet.getRange(row, P.SALE);
  if (salePrice === null) cell.setFormula(CONFIG.PRICE_FORMULA.replace(/\{r\}/g, row));
  else cell.setValue(salePrice);
}

function parseSalePrice_(v) {
  const n = parseMoney_(v, 'deinen Verkaufspreis');
  if (!(n > 0)) throw new Error('Bitte gib deinen Verkaufspreis als Zahl über 0 ein (z. B. 19.90).');
  return n;
}

function invoicesSheet_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.INVOICES_SHEET);
  if (!s) { ensureSheets_(); return invoicesSheet_(); }
  return s;
}

function invoicesOf_(userId) {
  const sheet = invoicesSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const needle = userId.toLowerCase();
  return sheet.getRange(2, 1, last - 1, I_HEADERS.length).getValues()
    .filter((r) => String(r[I.USER - 1]).toLowerCase() === needle)
    .map((r) => ({
      id: String(r[I.ID - 1]), number: String(r[I.NUMBER - 1]),
      date: dateText_(r[I.DATE - 1]), serviceDate: dateText_(r[I.SERVICE_DATE - 1]),
      recipient: parseJson_(r[I.RECIPIENT - 1], {}), items: parseJson_(r[I.ITEMS - 1], []),
      net: Number(r[I.NET - 1]) || 0, vatRate: Number(r[I.VAT_RATE - 1]) || 0, vat: Number(r[I.VAT - 1]) || 0,
      gross: Number(r[I.GROSS - 1]) || 0, smallBusiness: r[I.SMALL_BUSINESS - 1] === 'JA',
      sender: parseJson_(r[I.SENDER - 1], {}), createdAt: String(r[I.CREATED - 1]),
      sampleIds: String(r[I.SAMPLE_IDS - 1] || '').split(',').filter(String),
    }));
}

function findProductRow_(sheet, id, userId) {
  const last = sheet.getLastRow();
  if (!id || last < 2) throw new Error('Sample nicht gefunden.');
  const rows = sheet.getRange(2, P.ID, last - 1, 2).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id && String(rows[i][1]).toLowerCase() === userId.toLowerCase()) return i + 2;
  }
  throw new Error('Sample nicht gefunden.');
}

function productsSheet_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!s) { ensureSheets_(); return productsSheet_(); }
  return s;
}

function creatorsSheet_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CREATORS_SHEET);
  if (!s) { ensureSheets_(); return creatorsSheet_(); }
  return s;
}

function parseMoney_(v, label) {
  const n = Number(String(v === undefined ? '' : v).replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 100000) throw new Error('Bitte gib ' + label + ' als Zahl ein (z. B. 27.90).');
  return Math.round(n * 100) / 100;
}

/** Datum als Text yyyy-mm-dd (bleibt so in der Tabelle, keine Zeitzonen-Verschiebung). */
function parseDate_(v, label) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T00:00:00Z'))) throw new Error('Ungültiges ' + label + '.');
  return s;
}

function dateText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function parseJson_(v, fallback) {
  try { return v ? JSON.parse(String(v)) : fallback; } catch (_) { return fallback; }
}

function normalizeUser_(v) {
  const u = String(v || '').trim().replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{2,24}$/.test(u)) {
    throw new Error('Bitte gib einen gültigen TikTok-Username ein (2–24 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich).');
  }
  return u;
}

function parseRate_(v) {
  const n = Number(v);
  if (!isFinite(n) || n < 0 || n > 0.6) throw new Error('Ungültiger Steuersatz (0–60 %).');
  return Math.round(n * 10000) / 10000;
}

function parseUrl_(v, label) {
  const s = String(v || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s) || s.length > 500) throw new Error('Bitte füge einen gültigen ' + label + ' ein.');
  return s;
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

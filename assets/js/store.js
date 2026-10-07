/* Gemeinsame Shop-Bausteine: Header mit Suche, Menü, Merkliste, Footer, Produktkarten, Karussells. */
import { T, $, $$, html, lenis, lock, unlock, Spring, tf, hover, inview, rise, onFrame, stackedLines } from './core.js';

/* =====================================================================
   Produkt-Helfer
   ===================================================================== */
export const CAT_IMG = { Tech: 'cat-tech', Beauty: 'cat-beauty', Haushalt: 'cat-haushalt', Sonstiges: 'cat-sonstiges' };
export const catImage = (c) => `assets/img/${CAT_IMG[c] || 'cat-sonstiges'}.webp`;
export const discount = (p) => (p.originalPrice > 0 && p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0);
export const savings = (p) => (p.originalPrice > p.price ? p.originalPrice - p.price : 0);
export const displayName = (p) => {
  if (p.name) return p.name;
  const t = (p.videoTitle || '').replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  return 'TikTok Shop Produkt';
};
export const imageOf = (p) => T.safeUrl(p.thumbnail) || p.image || catImage(p.category);
export const productUrl = (p) => `product.html?id=${encodeURIComponent(p.id)}`;
export const sellerUrl = (u) => `shop.html?seller=${encodeURIComponent(u)}`;
export const videoIdOf = (p) => p.videoId || (String(p.videoLink || '').match(/\/video\/(\d+)/) || [])[1] || '';
const imgFallback = (p) => `onerror="this.onerror=null;this.src='${catImage(p.category)}'"`;

let productsPromise = null;
export function loadProducts() {
  if (!productsPromise) productsPromise = T.getProducts().catch((e) => { productsPromise = null; throw e; });
  return productsPromise;
}

/* =====================================================================
   Merkliste (lokal im Browser)
   ===================================================================== */
const WKEY = 'tts_wishlist';
const wishListeners = new Set();
export const wish = {
  ids() { try { return JSON.parse(localStorage.getItem(WKEY)) || []; } catch (_) { return []; } },
  has(id) { return wish.ids().includes(String(id)); },
  toggle(id) {
    id = String(id);
    const ids = wish.ids();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
    try { localStorage.setItem(WKEY, JSON.stringify(next)); } catch (_) { /* ignorieren */ }
    wishListeners.forEach((fn) => fn(next));
    return next.includes(id);
  },
  on(fn) { wishListeners.add(fn); },
};
addEventListener('storage', (e) => { if (e.key === WKEY) wishListeners.forEach((fn) => fn(wish.ids())); });

/* =====================================================================
   Icons
   ===================================================================== */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-mark" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.5"/><path d="M10 8.6v6.8l5.4-3.4z"/></g></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path fill="currentColor" d="M21.9 4.3L18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></g></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.3s-7.5-4.6-9.3-9.2C1.5 8 3.4 4.6 6.8 4.6c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.4 0 5.3 3.4 4.1 6.5-1.8 4.6-9.3 9.2-9.3 9.2z" fill="var(--heart-fill, none)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4"/></g></symbol>
  <symbol id="i-share" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></g></symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.6"/></g></symbol>
</svg>`;

/* =====================================================================
   Produktkarten
   ===================================================================== */
const heartBtn = (p, cls) =>
  `<button class="${cls}" type="button" data-wish="${T.esc(p.id)}" aria-pressed="${wish.has(p.id)}" aria-label="Auf die Merkliste"><svg><use href="#i-heart"/></svg></button>`;

/** Große Deal-Karte (dunkler Hintergrund) */
export function dealCard(p) {
  const off = discount(p);
  const video = T.safeUrl(p.videoLink);
  const url = productUrl(p);
  return `<li><article class="deal">
    <div class="deal__mw">
      <a class="deal__media" href="${url}" aria-label="${T.esc(displayName(p))} ansehen">
        <img src="${T.esc(imageOf(p))}" alt="" loading="lazy" referrerpolicy="no-referrer" ${imgFallback(p)}>
        <span class="deal__cat">${T.esc(p.category)}</span>
        ${off ? `<span class="deal__off">−${off} %</span>` : ''}
      </a>
      ${heartBtn(p, 'wish-btn deal__wish')}
    </div>
    <div class="deal__body">
      <h3 class="deal__name"><a href="${url}">${T.esc(displayName(p))}</a></h3>
      <div class="deal__price">
        <span class="deal__now">${T.fmtEUR(p.price)}</span>
        ${p.originalPrice ? `<s class="deal__was" aria-label="Originalpreis">${T.fmtEUR(p.originalPrice)}</s>` : ''}
      </div>
      <p class="deal__cond"><svg><use href="#i-check"/></svg><span>Zustand: Wie neu – nur 1x für Video ausgepackt</span></p>
      ${p.userId ? `<p class="deal__seller">von <a href="${sellerUrl(p.userId)}"><b>@${T.esc(p.userId)}</b></a></p>` : ''}
      <div class="deal__actions">
        ${video
          ? `<a class="btn-deal btn-deal--video" href="${T.esc(video)}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-play"/></svg>Video-Nachweis</a>`
          : `<span class="btn-deal btn-deal--video" aria-disabled="true"><svg><use href="#i-play"/></svg>Video folgt</span>`}
        <a class="btn-deal btn-deal--buy" href="${T.esc(T.buyLink(p))}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-send"/></svg>Jetzt kaufen</a>
      </div>
    </div>
  </article></li>`;
}

/** Kompakte Karte für Karussells (heller Hintergrund) */
export function miniCard(p) {
  const off = discount(p);
  return `<li class="mini"><a class="mini__link" href="${productUrl(p)}">
    <span class="mini__media"><img src="${T.esc(imageOf(p))}" alt="" loading="lazy" referrerpolicy="no-referrer" ${imgFallback(p)}>
      ${off ? `<span class="mini__off">−${off} %</span>` : ''}</span>
    <span class="mini__price"><b class="tag-price">${T.fmtEUR(p.price)}</b>${p.originalPrice ? `<s>${T.fmtEUR(p.originalPrice)}</s>` : ''}</span>
    <span class="mini__name">${T.esc(displayName(p))}</span>
  </a>${heartBtn(p, 'wish-btn mini__wish')}</li>`;
}

/** Animationen + Merkliste-Buttons für frisch gerenderte Karten */
export function bindCards(root, { stagger = 90, perRow = 4 } = {}) {
  $$('li', root).forEach((li, i) => {
    if (li.__bound) return; li.__bound = true;
    inview(li, ...rise(36), { tension: 190, friction: 26 }, (i % perRow) * stagger);
    const card = $('.deal, .mini__link', li);
    if (card && card.classList.contains('deal')) hover(card, card, { y: 0 }, { y: -6 }, { tension: 300, friction: 22 });
    const img = $('img', li);
    if (card && img) hover(card, img, { scale: 1 }, { scale: 1.04 }, { tension: 300, friction: 22 });
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-wish]');
  if (!b) return;
  e.preventDefault();
  const on = wish.toggle(b.dataset.wish);
  $$(`[data-wish="${CSS.escape(b.dataset.wish)}"]`).forEach((x) => x.setAttribute('aria-pressed', String(on)));
  if (on) pulse(b);
});
function pulse(el) {
  const icon = $('svg', el) || el;
  const s = new Spring({ scale: 1 }, { tension: 420, friction: 12 }, tf(icon));
  s.set({ scale: 1.35 }); s.to({ scale: 1 });
}

/* =====================================================================
   Karussell (horizontale Produktreihe)
   ===================================================================== */
export function carousel(section, items) {
  const track = $('.rail__track', section);
  track.innerHTML = items.map(miniCard).join('');
  bindCards(track, { stagger: 60, perRow: 6 });
  const prev = $('.rail__prev', section), next = $('.rail__next', section);
  const step = () => track.clientWidth * 0.85;
  const sync = () => {
    if (!prev) return;
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  };
  prev && prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next && next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
}
export const railHTML = (title, link, linkLabel = 'Alle ansehen') => `
  <div class="rail__head"><h2 class="rail__title">${title}</h2>${link ? `<a class="link-u" href="${link}">${linkLabel}</a>` : ''}
    <div class="rail__nav"><button class="arrow-btn rail__prev" type="button" aria-label="Zurück"><span class="hv"><span class="flip"><svg><use href="#i-arrow"/></svg></span></span></button>
    <button class="arrow-btn arrow-btn--solid rail__next" type="button" aria-label="Weiter"><span class="hv"><svg><use href="#i-arrow"/></svg></span></button></div></div>
  <ul class="rail__track"></ul>`;

/* =====================================================================
   Header, Menü, Merkliste-Drawer, Footer
   ===================================================================== */
const CATS = ['Tech', 'Beauty', 'Haushalt', 'Sonstiges'];

function headerHTML(q, cat) {
  return `<header class="sh" id="sh">
    <div class="sh__bar">
      <div class="sh__row">
        <button class="burger sh__burger" id="burger" type="button" aria-label="Menü öffnen" aria-expanded="false" aria-controls="menu"><i></i><i></i></button>
        <a class="brand sh__brand" href="index.html" aria-label="TTS Deals – Startseite"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals</a>
        <form class="sh__search" action="shop.html" role="search">
          <label class="sh__cat"><span class="sr-only">Kategorie</span>
            <select name="cat">${['', ...CATS].map((c) => `<option value="${c}"${c === cat ? ' selected' : ''}>${c || 'Alle'}</option>`).join('')}</select>
            <svg><use href="#i-chevron"/></svg></label>
          <input name="q" type="search" value="${T.esc(q)}" placeholder="Deals durchsuchen" aria-label="Suchbegriff" autocomplete="off" enterkeyhint="search">
          <button type="submit" aria-label="Suchen"><svg><use href="#i-search"/></svg></button>
        </form>
        <a class="sh__acct" href="dashboard.html"><svg><use href="#i-user"/></svg><span><small>Für Creator</small><b>Login</b></span></a>
        <button class="sh__wish" id="wishBtn" type="button" aria-label="Merkliste öffnen"><span class="sh__wishicon"><svg><use href="#i-heart"/></svg><i id="wishCount">0</i></span><b>Merkliste</b></button>
      </div>
      <nav class="sh__cats" aria-label="Kategorien">
        <a href="shop.html">Alle Deals</a>
        ${CATS.map((c) => `<a href="shop.html?cat=${c}">${c}</a>`).join('')}
        <a href="shop.html?sort=discount">Größte Rabatte</a>
        <a href="shop.html?sort=new">Neu eingetroffen</a>
        <a class="sh__cta" href="creator.html">Als Creator registrieren</a>
      </nav>
    </div>
  </header>`;
}

const MENU_HTML = `<div class="menu" id="menu" aria-hidden="true" inert>
  <div class="menu__bg" id="menuBg"></div>
  <div class="menu__panel" id="menuPanel" role="dialog" aria-modal="true" aria-label="Menü">
    <div class="menu__inner">
      <div class="menu__top">
        <a class="brand" href="index.html"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals</a>
        <button class="x-btn" id="menuClose" type="button" aria-label="Menü schließen"><span><svg><use href="#i-x"/></svg></span></button>
      </div>
      <nav class="menu__nav" aria-label="Menü">
        <a href="shop.html">Alle Deals</a>
        ${CATS.slice(0, 3).map((c) => `<a href="shop.html?cat=${c}">${c}</a>`).join('')}
        <a href="index.html#creator">Für Creator</a>
      </nav>
      <div class="menu__bottom">
        <a class="pill pill--light" href="creator.html">Als Creator registrieren <span class="arr"><svg><use href="#i-arrow"/></svg></span></a>
        <nav aria-label="Weitere Links"><a href="shop.html?sort=discount">Größte Rabatte</a><a href="index.html#faq">FAQ</a><a href="dashboard.html">Creator-Login</a></nav>
      </div>
    </div>
  </div>
</div>`;

const DRAWER_HTML = `<div class="drawer" id="drawer" aria-hidden="true" inert>
  <div class="drawer__bg" id="drawerBg"></div>
  <aside class="drawer__panel" id="drawerPanel" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
    <div class="drawer__head">
      <div><span class="eyebrow">Gemerkt</span><h2 id="drawerTitle">Merkliste</h2></div>
      <button class="x-btn x-btn--dark" id="drawerClose" type="button" aria-label="Merkliste schließen"><span><svg><use href="#i-x"/></svg></span></button>
    </div>
    <ul class="drawer__list" id="drawerList" data-lenis-prevent></ul>
    <div class="drawer__empty" id="drawerEmpty" hidden>
      <svg><use href="#i-heart"/></svg>
      <h3>Noch nichts gemerkt</h3>
      <p>Tippe auf das Herz bei einem Deal, um ihn hier zu sammeln.</p>
    </div>
    <div class="drawer__foot"><a class="pill pill--solid" href="shop.html">Weiter stöbern <span class="arr"><svg><use href="#i-arrow"/></svg></span></a></div>
  </aside>
</div>`;

function footerHTML() {
  return `<footer class="footer" id="kontakt">
    <div class="footer__cta">
      <div>
        <span class="eyebrow eyebrow--light">Für Creator</span>
        <p class="footer__big" data-lines="Bereit zu|verkaufen?">Bereit zu verkaufen?</p>
      </div>
      <a class="pill pill--light" id="footerCta" href="creator.html">Als Creator registrieren <span class="arr"><svg><use href="#i-arrow"/></svg></span></a>
    </div>
    <div class="footer__cols">
      <div class="footer__brand">
        <span class="brand"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals</span>
        <p>Das Outlet für Produkte, die TikTok Shop Creator nur einmal für ein Testvideo ausgepackt haben.</p>
      </div>
      <nav aria-label="Shop"><h4>Shop</h4><ul>
        <li><a href="shop.html">Alle Deals</a></li>
        ${CATS.map((c) => `<li><a href="shop.html?cat=${c}">${c}</a></li>`).join('')}
      </ul></nav>
      <nav aria-label="Creator"><h4>Creator</h4><ul>
        <li><a href="creator.html">Registrieren</a></li>
        <li><a href="dashboard.html">Creator-Login</a></li>
        <li><a href="${T.telegramBotLink('')}" target="_blank" rel="noopener noreferrer">Telegram-Bot</a></li>
      </ul></nav>
      <nav aria-label="Info"><h4>Info</h4><ul>
        <li><a href="index.html#ablauf">So funktioniert's</a></li>
        <li><a href="index.html#creator">Für Creator</a></li>
        <li><a href="index.html#faq">Häufige Fragen</a></li>
      </ul></nav>
    </div>
    <div class="footer__bar">
      <span>© 2026 TTS Deals. Alle Rechte vorbehalten.</span>
      <nav aria-label="Bildnachweis"><a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Fotos: Unsplash</a></nav>
    </div>
  </footer>`;
}

/** Overlay mit Spring-Animationen (Menü & Merkliste) */
function overlay({ root, bg, panel, from, to, cfg, onOpen, focus }) {
  const bgS = new Spring({ opacity: 0 }, { tension: 260, friction: 30 }, (s) => { bg.style.opacity = s.opacity; });
  const panelS = new Spring(from, cfg, panel.__apply || tf(panel));
  let open = false;
  const api = {
    get open() { return open; },
    show() {
      if (open) return; open = true;
      root.classList.add('is-open'); root.removeAttribute('inert'); root.setAttribute('aria-hidden', 'false');
      lock(); bgS.to({ opacity: 1 }); panelS.to(to);
      onOpen && onOpen(true);
      setTimeout(() => focus && focus.focus(), 60);
    },
    hide() {
      if (!open) return; open = false;
      root.classList.remove('is-open'); root.setAttribute('inert', ''); root.setAttribute('aria-hidden', 'true');
      bgS.to({ opacity: 0 }); panelS.to(from);
      onOpen && onOpen(false);
      unlock();
    },
  };
  bg.addEventListener('click', api.hide);
  return api;
}

export let menu, drawer;

/* ---------- Creator-Variante (Header, Menü, Footer) ---------- */
function creatorHeaderHTML() {
  return `<header class="sh sh--creator" id="sh">
    <div class="sh__bar">
      <div class="sh__row sh__row--creator">
        <button class="burger sh__burger" id="burger" type="button" aria-label="Menü öffnen" aria-expanded="false" aria-controls="menu"><i></i><i></i></button>
        <a class="brand sh__brand" href="./" aria-label="TTS Deals Creator – Startseite"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals<span class="sh__tag">Creator</span></a>
        <nav class="sh__nav" aria-label="Hauptnavigation">
          <a href="./#ablauf">So funktioniert's</a>
          <a href="./#rechner">Preisrechner</a>
          <a href="./#wege">Telegram &amp; Web</a>
          <a href="./#faq">FAQ</a>
        </nav>
        <div class="sh__actions">
          <a class="sh__login" href="dashboard.html"><svg><use href="#i-user"/></svg><span>Login</span></a>
          <a class="pill pill--neon pill--sm" href="creator.html">Registrieren</a>
        </div>
      </div>
    </div>
  </header>`;
}
const CREATOR_MENU_HTML = `<div class="menu" id="menu" aria-hidden="true" inert>
  <div class="menu__bg" id="menuBg"></div>
  <div class="menu__panel" id="menuPanel" role="dialog" aria-modal="true" aria-label="Menü">
    <div class="menu__inner">
      <div class="menu__top">
        <a class="brand" href="./"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals</a>
        <button class="x-btn" id="menuClose" type="button" aria-label="Menü schließen"><span><svg><use href="#i-x"/></svg></span></button>
      </div>
      <nav class="menu__nav" aria-label="Menü">
        <a href="./#rechner">Preisrechner</a>
        <a href="./#ablauf">So geht's</a>
        <a href="creator.html">Registrieren</a>
        <a href="dashboard.html">Login</a>
      </nav>
      <div class="menu__bottom">
        <a class="pill pill--light" href="creator.html">Als Creator registrieren <span class="arr"><svg><use href="#i-arrow"/></svg></span></a>
        <nav aria-label="Weitere Links"><a href="./#wege">Telegram &amp; Web</a><a href="./#faq">FAQ</a></nav>
      </div>
    </div>
  </div>
</div>`;
function creatorFooterHTML() {
  return `<footer class="footer" id="kontakt">
    <div class="footer__cta">
      <div>
        <span class="eyebrow eyebrow--light">Los geht's</span>
        <p class="footer__big" data-lines="Bereit für deinen|ersten Deal?">Bereit für deinen ersten Deal?</p>
      </div>
      <a class="pill pill--neon" id="footerCta" href="creator.html">Als Creator registrieren <span class="arr"><svg><use href="#i-arrow"/></svg></span></a>
    </div>
    <div class="footer__cols footer__cols--3">
      <div class="footer__brand">
        <span class="brand"><svg class="mark"><use href="#i-mark"/></svg>TTS Deals</span>
        <p>Die Plattform für TikTok Shop Creator: Produkte aus deinen Testvideos weiterverkaufen – mit automatisch berechnetem Preis.</p>
      </div>
      <nav aria-label="Für Creator"><h4>Für Creator</h4><ul>
        <li><a href="creator.html">Registrieren</a></li>
        <li><a href="dashboard.html">Login</a></li>
        <li><a href="${T.telegramBotLink('')}" target="_blank" rel="noopener noreferrer">Telegram-Bot</a></li>
      </ul></nav>
      <nav aria-label="Info"><h4>Info</h4><ul>
        <li><a href="./#ablauf">So funktioniert's</a></li>
        <li><a href="./#rechner">Preisrechner</a></li>
        <li><a href="./#faq">Häufige Fragen</a></li>
      </ul></nav>
    </div>
    <div class="footer__bar">
      <span>© 2026 TTS Deals. Alle Rechte vorbehalten.</span>
      <nav aria-label="Bildnachweis"><a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Fotos: Unsplash</a></nav>
    </div>
  </footer>`;
}

/**
 * Baut Header, Menü, Merkliste und Footer ein.
 * hero: Header liegt transparent über dem Hero.
 * mode: 'shop' (Marktplatz mit Suche & Merkliste) oder 'creator' (Creator-Bereich).
 */
export function renderChrome({ hero = false, mode = 'shop' } = {}) {
  const creator = mode === 'creator';
  const params = new URLSearchParams(location.search);
  document.body.insertAdjacentHTML('afterbegin', SPRITE + (creator ? creatorHeaderHTML() : headerHTML(params.get('q') || '', params.get('cat') || '')));
  document.body.insertAdjacentHTML('beforeend', creator ? CREATOR_MENU_HTML : MENU_HTML + DRAWER_HTML);
  const footSlot = $('#siteFooter');
  if (footSlot) {
    footSlot.outerHTML = creator ? creatorFooterHTML() : footerHTML();
    stackedLines($('.footer__big'));
    inview($('#footerCta'), ...rise(20), { tension: 200, friction: 24 }, 150);
  }

  const sh = $('#sh');
  if (hero) sh.classList.add('sh--hero');
  if (T.DEMO) {
    sh.insertAdjacentHTML('beforeend', `<p class="sh__demo">${creator ? 'Demo-Modus · Daten nur in diesem Browser' : 'Demo-Modus · Beispieldaten'}</p>`);
  }

  // Header-Höhe als CSS-Variable (für Abstände unter dem fixen Header)
  const setH = () => html.style.setProperty('--sh-h', sh.offsetHeight + 'px');
  new ResizeObserver(setH).observe(sh); setH();

  // Header: transparent über dem Hero, sonst solide; beim Runterscrollen ausblenden
  let lastY = 0, hidden = false;
  onFrame(() => {
    const y = lenis.scroll ?? scrollY;
    sh.classList.toggle('is-solid', !hero || y > 40);
    const goingDown = y > lastY + 2, goingUp = y < lastY - 2;
    if (goingDown && y > 220 && !hidden && !sh.contains(document.activeElement)) { hidden = true; sh.classList.add('is-hidden'); }
    else if ((goingUp || y < 120) && hidden) { hidden = false; sh.classList.remove('is-hidden'); }
    if (goingDown || goingUp) lastY = y;
  });

  // Menü
  const menuLinks = $$('.menu__nav a').map((a) => new Spring({ opacity: 0, y: 28 }, { tension: 200, friction: 26 }, tf(a)));
  let timers = [];
  menu = overlay({
    root: $('#menu'), bg: $('#menuBg'), panel: $('#menuPanel'),
    from: { opacity: 0, y: -24 }, to: { opacity: 1, y: 0 }, cfg: { tension: 220, friction: 28 }, focus: $('#menuClose'),
    onOpen(open) {
      $('#burger').setAttribute('aria-expanded', String(open));
      timers.forEach(clearTimeout);
      if (open) timers = menuLinks.map((s, i) => setTimeout(() => s.to({ opacity: 1, y: 0 }), 120 + i * 70));
      else menuLinks.forEach((s) => s.to({ opacity: 0, y: 28 }));
    },
  });
  $('#burger').addEventListener('click', menu.show);
  $('#menuClose').addEventListener('click', menu.hide);
  $$('.menu a').forEach((a) => a.addEventListener('click', () => menu.hide()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.hide(); drawer && drawer.hide(); } });

  if (!creator) {
    // Suche: leere Suche → alle Deals
    $('.sh__search').addEventListener('submit', (e) => {
      const f = e.currentTarget;
      if (!f.q.value.trim()) f.q.removeAttribute('name');
      if (!f.cat.value) f.cat.removeAttribute('name');
    });

    // Merkliste
    const panel = $('#drawerPanel');
    panel.__apply = (s) => { panel.style.transform = `translate3d(${s.x}%,0,0)`; };
    drawer = overlay({
      root: $('#drawer'), bg: $('#drawerBg'), panel,
      from: { x: 105 }, to: { x: 0 }, cfg: { tension: 260, friction: 30 }, focus: $('#drawerClose'),
      onOpen(open) { if (open) renderDrawer(); },
    });
    $('#wishBtn').addEventListener('click', drawer.show);
    $('#drawerClose').addEventListener('click', drawer.hide);

    const updateCount = (ids) => {
      const c = $('#wishCount');
      c.textContent = ids.length;
      c.hidden = !ids.length;
      if (drawer.open) renderDrawer();
    };
    wish.on(updateCount);
    updateCount(wish.ids());
  }

  // Hover-Mikrointeraktionen
  bindMicro(document);
}

async function renderDrawer() {
  const list = $('#drawerList'), empty = $('#drawerEmpty');
  const ids = wish.ids();
  if (!ids.length) { list.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  let all = [];
  try { all = await loadProducts(); } catch (_) { /* ignorieren */ }
  const items = ids.map((id) => all.find((p) => String(p.id) === id)).filter(Boolean);
  list.innerHTML = items.map((p) => `<li class="wl">
    <a class="wl__img" href="${productUrl(p)}"><img src="${T.esc(imageOf(p))}" alt="" referrerpolicy="no-referrer" ${imgFallback(p)}></a>
    <div class="wl__txt">
      <a class="wl__name" href="${productUrl(p)}">${T.esc(displayName(p))}</a>
      <span class="wl__price"><b class="tag-price">${T.fmtEUR(p.price)}</b>${p.originalPrice ? `<s>${T.fmtEUR(p.originalPrice)}</s>` : ''}</span>
      <a class="wl__buy" href="${T.esc(T.buyLink(p))}" target="_blank" rel="noopener noreferrer">Jetzt kaufen →</a>
    </div>
    <button class="wl__rm" type="button" data-wish="${T.esc(p.id)}" aria-pressed="true" aria-label="Von der Merkliste entfernen"><svg><use href="#i-x"/></svg></button>
  </li>`).join('');
  if (!items.length) empty.hidden = false;
}

/** Pfeil-Nudges, Arrow-Buttons und X-Icons */
export function bindMicro(root) {
  $$('.pill', root).forEach((p) => { if (p.__m) return; p.__m = 1; const a = $('.arr', p); if (a) hover(p, a, { x: 0 }, { x: 5 }, { tension: 320, friction: 20 }); });
  $$('.arrow-btn', root).forEach((b) => { if (b.__m) return; b.__m = 1; hover(b, $('.hv', b), { scale: 1 }, { scale: 1.15 }, { tension: 320, friction: 18 }); });
  $$('.x-btn', root).forEach((b) => { if (b.__m) return; b.__m = 1; hover(b, $('span', b), { rotate: 0 }, { rotate: 90 }, { tension: 300, friction: 18 }); });
}

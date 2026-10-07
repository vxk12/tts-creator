/* TTS Deals – Startseite: Loader, Hero, Entdecken-Kacheln, Kategorien-Karussell, Live-Deals, Kennzahlen. */
import {
  T, $, $$, RM, lock, unlock, Spring, tf, rise, inview, hover, onView, whenReady, setReady,
  stackedLines, words, fadeWords, refire, addParallax, renderDots, clamp,
} from './core.js';
import {
  renderChrome, loadProducts, dealCard, bindCards, bindMicro, carousel, railHTML,
  discount, displayName, imageOf, productUrl, catImage,
} from './store.js';

window.scrollTo(0, 0);
renderChrome({ hero: true });

/* =====================================================================
   Loader
   ===================================================================== */
const MIN_VISIBLE_MS = RM ? 200 : 1400, MAX_VISIBLE_MS = 2600, EXIT_MS = RM ? 0 : 850;
const loader = $('#loader');
loader.style.animation = 'none';
lock();
new Spring({ opacity: 0, y: 16 }, { tension: 200, friction: 22 }, tf($('#loaderBrand'))).to({ opacity: 1, y: 0 });
requestAnimationFrame(() => requestAnimationFrame(() => loader.classList.add('is-filling')));

let countdown = false, done = false;
function startCountdown() { if (countdown) return; countdown = true; setTimeout(finishLoader, MIN_VISIBLE_MS); }
function finishLoader() {
  if (done) return;
  done = true;
  setReady();
  unlock();
  loader.style.transition = `transform ${EXIT_MS}ms var(--ease-in-out-cubic)`;
  loader.style.transform = 'translateY(-105%)';
  setTimeout(() => loader.remove(), EXIT_MS + 20);
}
if (document.readyState === 'complete') startCountdown();
else addEventListener('load', startCountdown, { once: true });
setTimeout(() => { if (!countdown) { countdown = true; finishLoader(); } }, MAX_VISIBLE_MS);

/* =====================================================================
   Statische Reveals
   ===================================================================== */
words($('#heroTitle'), { stagger: 140, duration: 1100, gated: true });
const tg = $('#heroTagline');
stackedLines(tg, { stagger: 110, delay: 350, duration: 900, gated: true });
$$('main [data-lines]').forEach((el) => { if (el !== tg) stackedLines(el); });
fadeWords($('#creatorBody'));

addParallax($('#heroPlate'), $('.hero'), 'y', 0, 12);

inview($('#slider'), ...rise(28), { tension: 200, friction: 26 }, 650, true);
inview($('#member'), ...rise(28), { tension: 200, friction: 26 }, 780, true);
inview($('#pct'), { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }, { tension: 220, friction: 22 });
inview($('#badgeCard'), ...rise(24), { tension: 200, friction: 26 }, 120);
inview($('#coach'), { opacity: 0, y: 60, scale: 0.92 }, { opacity: 1, y: 0, scale: 1 }, { tension: 170, friction: 26 });

$$('.steps .row').forEach((row, i) => {
  inview(row, ...rise(26), { tension: 190, friction: 26 }, i * 90);
  hover(row.closest('a'), $('.row__arrow > span', row), { x: 0, opacity: 0.55 }, { x: 8, opacity: 1 }, { tension: 300, friction: 20 });
});
inview($('#creatorIcon'), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }, { tension: 240, friction: 20 });
$$('.tiles figure').forEach((fig, i) => {
  inview(fig, ...rise(48), { tension: 180, friction: 26 }, i * 140);
  hover(fig, $('img', fig), { scale: 1 }, { scale: 1.03 }, { tension: 300, friction: 22 });
});
$$('.stat').forEach((el, i) => inview(el, ...rise(30), { tension: 180, friction: 24 }, i * 110));
$$('.faq li').forEach((li, i) => {
  inview(li, ...rise(40), { tension: 180, friction: 26 }, i * 120);
  const card = $('.qa', li);
  hover(card, card, { y: 0 }, { y: -8 }, { tension: 300, friction: 22 });
});
bindMicro(document);

/* =====================================================================
   Kategorien-Karussell (Trust)
   ===================================================================== */
const SLIDES = [
  { headline: ['Einmal', 'Gefilmt,', 'Fast', 'Neu'], cat: 'Tech', role: 'Kopfhörer, Gadgets & Zubehör', alt: 'Kopfhörer und Smartphone auf einem Schreibtisch' },
  { headline: ['Echte', 'Creator,', 'Echte', 'Deals'], cat: 'Beauty', role: 'Pflege, Make-up & Beauty-Tools', alt: 'Frau testet ein Beauty-Gerät' },
  { headline: ['Video', 'Checken,', 'Clever', 'Sparen'], cat: 'Haushalt', role: 'Küche, Wohnen & Alltagshelfer', alt: 'Frisch aufgeschäumter Milchkaffee' },
];
SLIDES.forEach((s) => { const i = new Image(); i.src = catImage(s.cat); });
const gws = $$('[data-gw]');
const trustSec = $('#trust');
const coachImg = $('#coachImg');
const photo = new Spring({ opacity: 1 }, { tension: 260, friction: 26 }, (s) => { coachImg.style.opacity = s.opacity; });
let slide = 0;
const PX = [[-3, 3], [3, -3], [-2, 4], [4, -3]];
gws.forEach((w, i) => addParallax(w, trustSec, 'x', PX[i][0], PX[i][1]));

function renderTrust(first = false) {
  const s = SLIDES[slide];
  $('#trust-title').setAttribute('aria-label', s.headline.join(' '));
  gws.forEach((w, i) => (first ? (w.firstElementChild.textContent = s.headline[i]) : refire(w, s.headline[i])));
  if (!first) photo.set({ opacity: 0 });
  coachImg.src = catImage(s.cat); coachImg.alt = s.alt;
  $('#coachName').textContent = s.cat;
  $('#coachRole').textContent = s.role;
  $('#coachLink').href = `shop.html?cat=${s.cat}`;
  if (!first) photo.to({ opacity: 1 });
  renderDots($('#trustDots'), SLIDES.length, slide, (i) => { slide = i; renderTrust(); });
}
renderTrust(true);
onView($('#trust-title'), () => gws.forEach((w) => w.classList.add('is-in')));
$('#trustPrev').addEventListener('click', () => { slide = (slide - 1 + SLIDES.length) % SLIDES.length; renderTrust(); });
$('#trustNext').addEventListener('click', () => { slide = (slide + 1) % SLIDES.length; renderTrust(); });

/* =====================================================================
   Entdecken: Amazon-artige Kategorie-Kacheln
   ===================================================================== */
const byNew = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
function tileCard(title, items, cat, linkLabel) {
  const link = `shop.html?cat=${cat}`;
  const body = items.length >= 2
    ? `<div class="t4__grid">${items.slice(0, 4).map((p) => `<a class="t4__item" href="${productUrl(p)}">
        <span class="t4__img"><img src="${T.esc(imageOf(p))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${catImage(p.category)}'"></span>
        <span class="t4__label">${T.esc(displayName(p))}</span></a>`).join('')}</div>`
    : `<a class="t4__single" href="${items[0] ? productUrl(items[0]) : link}"><img src="${T.esc(items[0] ? imageOf(items[0]) : catImage(cat))}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>`;
  return `<article class="t4"><h2 class="t4__title">${title}</h2>${body}<a class="link-u t4__more" href="${link}">${linkLabel}</a></article>`;
}
function dealOfDay(p) {
  if (!p) return '';
  const off = discount(p);
  return `<article class="t4 t4--dark"><div class="t4__head"><h2 class="t4__title">Deal des Tages</h2>${off ? `<span class="t4__off">−${off} %</span>` : ''}</div>
    <a class="t4__hero" href="${productUrl(p)}"><img src="${T.esc(imageOf(p))}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
    <a class="t4__name" href="${productUrl(p)}">${T.esc(displayName(p))}</a>
    <span class="t4__price"><b>${T.fmtEUR(p.price)}</b>${p.originalPrice ? `<s>${T.fmtEUR(p.originalPrice)}</s>` : ''}</span>
    <a class="link-u t4__more" href="shop.html?sort=discount">Alle Top-Rabatte</a></article>`;
}
function renderDiscover(all) {
  const of = (c) => all.filter((p) => p.category === c).sort(byNew);
  const top = all.slice().sort((a, b) => discount(b) - discount(a));
  const box = $('#tiles4');
  box.innerHTML =
    tileCard('Top in Tech', of('Tech'), 'Tech', 'Mehr Tech-Deals') +
    tileCard('Beauty-Favoriten', of('Beauty'), 'Beauty', 'Mehr Beauty-Deals') +
    tileCard('Fürs Zuhause', [...of('Haushalt'), ...of('Sonstiges')], 'Haushalt', 'Mehr fürs Zuhause') +
    dealOfDay(top[0]);
  $$('.t4', box).forEach((c, i) => inview(c, ...rise(36), { tension: 190, friction: 26 }, i * 90));
  $$('.t4__img img, .t4__hero img, .t4__single img', box).forEach((img) => {
    const a = img.closest('a'); hover(a, img, { scale: 1 }, { scale: 1.05 }, { tension: 300, friction: 22 });
  });

  const rail = $('#railTop');
  if (top.length > 2) {
    rail.innerHTML = railHTML('Größte Rabatte', 'shop.html?sort=discount');
    carousel(rail, top.slice(0, 12));
    bindMicro(rail);
  } else rail.hidden = true;
}

/* =====================================================================
   Live-Deals (Startseite: neueste 8)
   ===================================================================== */
const HOME_LIMIT = 8;
const state = { all: [], cat: 'Alle' };
const grid = $('#grid'), chips = $('#chips'), count = $('#count'), empty = $('#empty');

function renderChips() {
  const counts = state.all.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {});
  chips.innerHTML = ['Alle', ...T.CATEGORIES].map((c) =>
    `<button class="chip" type="button" data-chip="${c}" aria-pressed="${c === state.cat}">${c}${c !== 'Alle' && counts[c] ? `<small>${counts[c]}</small>` : ''}</button>`).join('');
}
function renderGrid() {
  const list = state.all.filter((p) => state.cat === 'Alle' || p.category === state.cat);
  grid.innerHTML = list.slice(0, HOME_LIMIT).map(dealCard).join('');
  bindCards(grid);
  empty.hidden = list.length > 0;
  if (!list.length) empty.innerHTML = '<h3>Noch keine Deals in dieser Kategorie</h3><p>Schau bald wieder vorbei – Creator stellen laufend neue Produkte ein.</p>';
  count.textContent = `${list.length} ${list.length === 1 ? 'Angebot' : 'Angebote'}`;
  const all = $('#allDeals');
  all.href = state.cat === 'Alle' ? 'shop.html' : `shop.html?cat=${state.cat}`;
  all.firstChild.textContent = list.length > HOME_LIMIT ? `Alle ${list.length} Deals ansehen ` : 'Alle Deals ansehen ';
}
chips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-chip]');
  if (b) { state.cat = b.dataset.chip; renderChips(); renderGrid(); }
});
function skeletons(n) {
  grid.innerHTML = Array.from({ length: n }, () => `<li aria-hidden="true"><div class="deal deal--sk"><div class="deal__media"></div>
    <div class="deal__body"><div class="sk" style="width:80%"></div><div class="sk" style="width:45%;height:1.8rem"></div><div class="sk" style="width:70%"></div>
    <div class="sk" style="height:2.6rem;border-radius:99rem;margin-top:.5rem"></div><div class="sk" style="height:2.6rem;border-radius:99rem"></div></div></div></li>`).join('');
}

/* ---------- Hero-Deal-Slider ---------- */
let sliderIdx = 0, sliderTimer = null, sliderDeals = [];
function chipHTML(p) {
  return `<a class="deal-chip glass" href="${productUrl(p)}">
    <img src="${T.esc(imageOf(p))}" alt="" referrerpolicy="no-referrer">
    <span class="deal-chip__txt">
      <span class="deal-chip__brand">${T.esc(p.category)} · ${T.fmtEUR(p.price)}</span>
      <span class="deal-chip__title">${T.esc(displayName(p))}</span>
      <span class="deal-chip__cta">Zum Deal →</span>
    </span></a>`;
}
function showSlide(i, first = false) {
  const stage = $('#sliderStage');
  const old = stage.firstElementChild;
  sliderIdx = (i + sliderDeals.length) % sliderDeals.length;
  const tpl = document.createElement('div');
  tpl.innerHTML = chipHTML(sliderDeals[sliderIdx]);
  const card = tpl.firstElementChild;
  stage.prepend(card);
  const cfg = { tension: 210, friction: 24 };
  if (!first) {
    new Spring({ opacity: 0, y: 16, scale: 0.96 }, cfg, tf(card)).to({ opacity: 1, y: 0, scale: 1 });
    if (old) {
      new Spring({ opacity: 1, y: 0, scale: 1 }, cfg, tf(old)).to({ opacity: 0, y: -16, scale: 0.96 });
      setTimeout(() => old.remove(), 700);
    }
  }
  renderDots($('#sliderDots'), sliderDeals.length, sliderIdx, (k) => { showSlide(k); restartAutoplay(); });
}
function restartAutoplay() {
  clearInterval(sliderTimer);
  if (sliderDeals.length > 1) sliderTimer = setInterval(() => showSlide(sliderIdx + 1), 3800);
}

/* ---------- Kennzahlen ---------- */
function computeStats(list) {
  const withOrig = list.filter((p) => p.originalPrice > 0);
  const avg = withOrig.length ? Math.round(withOrig.reduce((s, p) => s + discount(p), 0) / withOrig.length) : 0;
  const creators = new Set(list.map((p) => (p.userId || '').toLowerCase()).filter(Boolean)).size;
  const video = list.length ? Math.round((list.filter((p) => T.safeUrl(p.videoLink)).length / list.length) * 100) : 0;
  return { deals: list.length, creators, avg, video };
}
function countUp(el, value, suffix = '') {
  const start = performance.now(), dur = RM ? 1 : 1400;
  const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  (function tick(now) {
    const t = clamp((now - start) / dur, 0, 1);
    el.innerHTML = Math.round(value * ease(t)) + (suffix ? `<em>${suffix}</em>` : '');
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

async function load() {
  skeletons(4);
  renderChips();
  try {
    state.all = await loadProducts();
  } catch (err) {
    grid.innerHTML = '';
    count.textContent = '';
    empty.hidden = false;
    empty.innerHTML = `<h3>Deals konnten nicht geladen werden</h3><p>${T.esc(err.message)}</p><button class="pill pill--light" type="button" id="retry">Erneut versuchen</button>`;
    $('#retry').onclick = () => { empty.hidden = true; load(); };
    $('#entdecken').hidden = true;
    return;
  }
  renderChips();
  renderGrid();
  renderDiscover(state.all);

  const st = computeStats(state.all);
  $('#avgSave').textContent = st.avg ? `−${st.avg}%` : '–';
  onView($('.stats dl'), () => {
    countUp($('[data-stat="deals"]'), st.deals);
    countUp($('[data-stat="creators"]'), st.creators);
    countUp($('[data-stat="avg"]'), st.avg, '%');
    countUp($('[data-stat="video"]'), st.video, '%');
  });

  sliderDeals = state.all.slice().sort((a, b) => discount(b) - discount(a)).slice(0, 3);
  if (sliderDeals.length) whenReady(() => { showSlide(0, true); restartAutoplay(); });
  else $('#slider').hidden = true;
}
load();
window.__pageReady = true;

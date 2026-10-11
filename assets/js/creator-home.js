/* Creator-Startseite: Loader, Hero mit Preis-Beispielen, Workflow, Preisrechner, Status-Codes. */
import {
  T, $, $$, RM, lock, unlock, Spring, tf, rise, inview, hover, onView, whenReady, setReady,
  stackedLines, words, fadeWords, addParallax, renderDots,
} from './core.js';
import { renderChrome, bindMicro } from './store.js';
import { rateSelector, priceCounter, tierPicker, offerRowsHTML, LOSS_NOTE } from './pricing-ui.js';

const P = T.PRICING;
window.scrollTo(0, 0);
renderChrome({ hero: true, mode: 'creator' });

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
   Reveals & Mikro-Interaktionen
   ===================================================================== */
words($('#heroTitle'), { stagger: 140, duration: 1100, gated: true });
const tg = $('#heroTagline');
stackedLines(tg, { stagger: 110, delay: 350, duration: 900, gated: true });
$$('main [data-lines]').forEach((el) => { if (el !== tg) stackedLines(el); });
fadeWords($('#wegeBody'));
addParallax($('#heroPlate'), $('.hero'), 'y', 0, 12);

inview($('#slider'), ...rise(28), { tension: 200, friction: 26 }, 650, true);
inview($('#member'), ...rise(28), { tension: 200, friction: 26 }, 780, true);
$$('.steps .row').forEach((row, i) => {
  inview(row, ...rise(26), { tension: 190, friction: 26 }, i * 90);
  hover(row.closest('a'), $('.row__arrow > span', row), { x: 0, opacity: 0.55 }, { x: 8, opacity: 1 }, { tension: 300, friction: 20 });
});
inview($('#calcInputs'), ...rise(36), { tension: 190, friction: 26 }, 0);
inview($('#calcResult'), { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1 }, { tension: 180, friction: 24 }, 140);
inview($('#creatorIcon'), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }, { tension: 240, friction: 20 });
$$('.tiles figure').forEach((fig, i) => {
  inview(fig, ...rise(48), { tension: 180, friction: 26 }, i * 140);
  hover(fig, $('img', fig), { scale: 1 }, { scale: 1.03 }, { tension: 300, friction: 22 });
});
$$('.faq li').forEach((li, i) => {
  inview(li, ...rise(40), { tension: 180, friction: 26 }, i * 120);
  const card = $('.qa', li);
  hover(card, card, { y: 0 }, { y: -8 }, { tension: 300, friction: 22 });
});

/* =====================================================================
   Hero: Preis-Beispiele (Autoplay)
   ===================================================================== */
const EXAMPLES = [
  { purchase: 27, tier: 'fair', rate: 0.3 },
  { purchase: 49.9, tier: 'schnell', rate: 0.42 },
  { purchase: 120, tier: 'sofort', rate: 0.3 },
];
let exIdx = 0, exTimer = null;
function exampleHTML({ purchase, tier, rate }) {
  const o = P.offer(purchase, tier, rate);
  return `<a class="deal-chip glass" href="#rechner">
    <img src="assets/img/unbox.webp" alt="">
    <span class="deal-chip__txt">
      <span class="deal-chip__brand">Stufe ${o.tier.label} · Steuer ${T.pct(rate)}</span>
      <span class="deal-chip__title">${T.fmtEUR(o.purchase)} → <b class="deal-chip__price">${T.fmtEUR(o.price)}</b></span>
      <span class="deal-chip__cta">Echter Verlust ${T.fmtEUR(o.loss)} →</span>
    </span></a>`;
}
function showExample(i, first = false) {
  const stage = $('#sliderStage');
  const old = stage.firstElementChild;
  exIdx = (i + EXAMPLES.length) % EXAMPLES.length;
  const tpl = document.createElement('div');
  tpl.innerHTML = exampleHTML(EXAMPLES[exIdx]);
  const card = tpl.firstElementChild;
  stage.prepend(card);
  const cfg = { tension: 210, friction: 24 };
  if (!first) {
    new Spring({ opacity: 0, y: 16, scale: 0.96 }, cfg, tf(card)).to({ opacity: 1, y: 0, scale: 1 });
    if (old) { new Spring({ opacity: 1, y: 0, scale: 1 }, cfg, tf(old)).to({ opacity: 0, y: -16, scale: 0.96 }); setTimeout(() => old.remove(), 700); }
  }
  renderDots($('#sliderDots'), EXAMPLES.length, exIdx, (k) => { showExample(k); restart(); });
}
function restart() { clearInterval(exTimer); exTimer = setInterval(() => showExample(exIdx + 1), 3800); }
whenReady(() => { showExample(0, true); restart(); });

/* =====================================================================
   Preisrechner
   ===================================================================== */
const priceIn = $('#calcPrice');
const out = priceCounter($('#calcOut'));
let started = false;

const rs = rateSelector($('#calcRate'), { idPrefix: 'calc', onChange: update, initial: { rate: 0.3, mode: 'bracket' } });
const tiers = tierPicker($('#calcTiers'), { onChange: update });

function update() {
  const purchase = P.parseMoney(priceIn.value);
  const okPrice = isFinite(purchase) && purchase > 0 && purchase <= 100000;
  $('#calcErr').hidden = okPrice || priceIn.value.trim() === '';
  priceIn.setAttribute('aria-invalid', String(!okPrice && priceIn.value.trim() !== ''));
  const rate = rs.rate;
  tiers.update(okPrice ? purchase : NaN, rate);
  const cta = $('#calcCta');

  if (!okPrice || rate == null) {
    out.set(null);
    $('#calcRows').innerHTML = '';
    $('#calcLabel').textContent = 'Dein Verkaufspreis';
    $('#calcNote').textContent = !okPrice ? 'Gib deinen Einkaufspreis ein.' : 'Wähle deinen Steuersatz.';
    cta.href = 'creator.html';
    return;
  }
  const o = P.offer(purchase, tiers.value, rate);
  out.set(o.price, { instant: !started });
  $('#calcLabel').textContent = `Dein Verkaufspreis · Stufe ${o.tier.label}`;
  $('#calcRows').innerHTML = offerRowsHTML(o);
  $('#calcNote').textContent = LOSS_NOTE;
  cta.href = `creator.html?rate=${rate}&mode=${rs.mode}`;
}
priceIn.addEventListener('input', update);
priceIn.addEventListener('blur', () => {
  const v = P.parseMoney(priceIn.value);
  if (isFinite(v) && v > 0) priceIn.value = v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});
update();
// Beim ersten Sichtkontakt den Preis von 0 hochzählen lassen
onView($('#calcResult'), () => {
  started = true;
  const v = out.value; out.set(0, { instant: true }); setTimeout(() => { out.set(v); }, 250);
});

/* =====================================================================
   Preisstufen-Übersicht
   ===================================================================== */
const cells = [
  ...P.TIERS.map((t) => ({ v: `${Math.round(t.factor * 100)}`, unit: '%', l: `${t.label} – Verkaufspreis = ${Math.round(t.factor * 100)} % vom Einkaufspreis` })),
  { v: '1−t', unit: '', l: 'Echter Verlust = Differenz × (1 − dein Steuersatz t)' },
];
$('#statusCells').innerHTML = cells.map((c) => `<div class="stat" data-spring><dt class="sr-only">${c.l}</dt><dd>
  <div class="stat__v">${c.v}<em>${c.unit}</em></div><div class="stat__l">${c.l}</div></dd></div>`).join('');
$$('#statusCells .stat').forEach((el, i) => inview(el, ...rise(30), { tension: 180, friction: 24 }, i * 110));

bindMicro(document);
window.__pageReady = true;

/* Stufe 1: Intelligentes Onboarding-Formular (einmalig). */
import { T, $, $$, Spring, tf, setReady } from './core.js';
import { renderChrome, bindMicro } from './store.js';
import { rateSelector } from './pricing-ui.js';

renderChrome({ mode: 'creator' });
setReady();

const P = T.PRICING;
const EXAMPLE_PURCHASE = 27;
const USER_RE = /^[A-Za-z0-9._]{2,24}$/;

const form = $('#wizard');
const errorBox = $('#error');
const userInput = $('#userId');
const submitBtn = $('#submit');
const data = { isShopCreator: null, userId: '' };

/* ---------- Schritte ---------- */
const ORDER = { 1: 1, 2: 2, 3: 3, success: 4, denied: 1 };
function show(step) {
  const target = form.querySelector(`[data-step="${step}"]`);
  form.querySelectorAll('[data-step]').forEach((s) => { s.hidden = s !== target; });
  new Spring({ opacity: 0, y: 18 }, { tension: 240, friction: 26 }, tf(target)).to({ opacity: 1, y: 0 });

  const n = ORDER[step] || 1;
  $$('#progress span').forEach((b, i) => b.classList.toggle('on', i < Math.min(n, 3)));
  $('#progress').hidden = step === 'success' || step === 'denied';
  $$('#asteps li').forEach((li, i) => {
    li.classList.toggle('is-done', i + 1 < n || (step === 'success' && i < 3));
    li.classList.toggle('is-active', i + 1 === n);
  });
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
const hideError = () => { errorBox.hidden = true; };
const press = (sel, btn) => form.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

/* Feld 1: JA / NEIN */
form.querySelectorAll('[data-creator]').forEach((btn) => btn.addEventListener('click', () => {
  press('[data-creator]', btn);
  data.isShopCreator = btn.dataset.creator === 'yes';
  if (data.isShopCreator) { show(2); setTimeout(() => userInput.focus(), 300); }
  else show('denied'); // Nutzung wird sofort verweigert
}));
form.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.back)));

/* Feld 2: Username */
function validateUser() {
  const v = userInput.value.trim().replace(/^@+/, '');
  userInput.value = v;
  const ok = USER_RE.test(v);
  userInput.setAttribute('aria-invalid', String(!ok));
  if (!ok) showError('Bitte gib einen gültigen TikTok-Username ein (2–24 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich).');
  else { hideError(); data.userId = v; $('#aUser').textContent = '@' + v; }
  return ok;
}
$('#toStep3').addEventListener('click', () => { if (validateUser()) show(3); });
userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (validateUser()) show(3); } });

/* Feld 3: Grenzsteuersatz → Status_Code (+ Live-Beispiel) */
const params = new URLSearchParams(location.search);
const preRate = params.has('rate') ? Number(params.get('rate')) : null;
const rs = rateSelector($('#rate'), {
  idPrefix: 'ob',
  question: false,
  onChange: renderPreview,
  initial: preRate != null && isFinite(preRate) ? { rate: preRate, mode: params.get('mode') } : null,
});
function renderPreview(rate) {
  const box = $('#preview');
  $('#aRate').textContent = rate == null ? '–' : rate.toFixed(2);
  if (rate == null) { box.hidden = true; return; }
  const b = P.breakdown(EXAMPLE_PURCHASE, rate);
  $('#previewTxt').textContent = `${T.fmtEUR(EXAMPLE_PURCHASE)} Einkaufspreis → Preis = ${Math.round(b.factor * 100)} %`;
  $('#previewPrice').textContent = T.fmtEUR(b.price);
  if (box.hidden) { box.hidden = false; new Spring({ opacity: 0, y: 10 }, { tension: 260, friction: 24 }, tf(box)).to({ opacity: 1, y: 0 }); }
}
renderPreview(rs.rate);

/* Absenden */
const SUBMIT_LABEL = submitBtn.innerHTML;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (data.isShopCreator !== true) return show(1);
  if (!validateUser()) return show(2);
  const err = rs.validate();
  if (err) return showError(err);
  const statusCode = rs.rate;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Wird gespeichert …';
  try {
    const res = await T.register({ isShopCreator: true, userId: data.userId, statusCode });
    T.session.set({ userId: res.creator.userId, creatorKey: res.creatorKey });
    const c = res.creator;
    $('#okUser').textContent = '@' + c.userId;
    $('#sumUser').textContent = '@' + c.userId;
    $('#sumRate').textContent = `${c.statusCode.toFixed(2)} (${T.pct(c.statusCode)})`;
    $('#sumFactor').textContent = `${Math.round(P.factor(c.statusCode) * 100)} % vom Einkaufspreis`;
    $('#creatorKey').textContent = res.creatorKey;
    $('#telegramBtn').href = T.telegramBotLink(c.userId);
    show('success');
  } catch (ex) {
    showError(ex.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = SUBMIT_LABEL;
  }
});

$('#copyKey').addEventListener('click', async (e) => {
  const key = $('#creatorKey').textContent;
  try { await navigator.clipboard.writeText(key); e.target.textContent = 'Kopiert ✓'; }
  catch (_) {
    const r = document.createRange(); r.selectNodeContents($('#creatorKey'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
});

// Direkt aus dem Preisrechner? Dann ist Schritt 3 schon vorbelegt.
show(1);
bindMicro(document);
window.__pageReady = true;

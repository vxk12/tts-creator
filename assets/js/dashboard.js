/* Creator-Dashboard: Telegram verbinden, Steuersatz ändern, Samples (Web-Upload mit Preisstufen). */
import { T, $, $$, Spring, tf, rise, inview, setReady } from './core.js';
import { renderChrome, bindMicro } from './store.js';
import { priceCounter, rateSelector, tierPicker, offerRowsHTML, LOSS_NOTE, RATE_DISCLAIMER } from './pricing-ui.js';

renderChrome({ mode: 'creator' });
setReady();

const P = T.PRICING;
const loginView = $('#loginView'), dashView = $('#dashView');
let creds = null, creator = null, animated = false;

const counter = priceCounter($('#resultPrice'));
const priceIn = $('#price');
const tiers = tierPicker($('#tierSel'), { onChange: updatePreview });
const rs = rateSelector($('#rateSel'), { idPrefix: 'dash', onChange: () => { $('#rateMsg').hidden = true; } });
$('#rateNote').textContent = RATE_DISCLAIMER;

function setBusy(btn, busy) {
  if (!btn.__label) btn.__label = btn.innerHTML;
  btn.disabled = busy;
  btn.innerHTML = busy ? '<span class="spinner"></span>Bitte warten …' : btn.__label;
}
function reveal(el) { new Spring({ opacity: 0, y: 20 }, { tension: 220, friction: 26 }, tf(el)).to({ opacity: 1, y: 0 }); }
function showMsg(el, ok, text) { el.className = ok ? 'alert--ok' : 'alert--error'; el.style.marginTop = '1rem'; el.textContent = text; el.hidden = false; }

/* ---------- Login ---------- */
function showLogin(msg) {
  dashView.hidden = true;
  loginView.hidden = false;
  reveal(loginView);
  const s = T.session.get();
  if (s && s.userId) $('#loginUser').value = s.userId;
  if (msg) { $('#loginError').textContent = msg; $('#loginError').hidden = false; }
}
async function doLogin(c) {
  const res = await T.login(c);
  creds = { userId: res.creator.userId, creatorKey: c.creatorKey };
  creator = res.creator;
  T.session.set(creds);
  showDashboard();
}
loginView.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').hidden = true;
  const userId = $('#loginUser').value.trim().replace(/^@+/, '');
  const creatorKey = $('#loginKey').value.trim();
  if (!userId || !creatorKey) { $('#loginError').textContent = 'Bitte Username und Creator-Key eingeben.'; $('#loginError').hidden = false; return; }
  setBusy($('#loginBtn'), true);
  try { await doLogin({ userId, creatorKey }); }
  catch (err) { $('#loginError').textContent = err.message; $('#loginError').hidden = false; }
  finally { setBusy($('#loginBtn'), false); }
});
$('#logout').addEventListener('click', () => { T.session.clear(); creds = creator = null; $('#loginKey').value = ''; showLogin(); });

/* ---------- Dashboard ---------- */
function renderRate() {
  $('#statRate').textContent = T.pct(creator.statusCode);
  $('#rateNow').textContent = `${T.pct(creator.statusCode)} (Status_Code ${creator.statusCode.toFixed(2)})`;
  $('#noteRate').textContent = creator.statusCode.toFixed(2);
}
function showDashboard() {
  loginView.hidden = true;
  dashView.hidden = false;
  reveal(dashView);
  $('#hello').textContent = 'Hi @' + creator.userId;
  $('#noteUser').textContent = '@' + creator.userId;
  $('#botLink').href = T.telegramBotLink(creator.userId);
  $('#keyline').hidden = !creds.creatorKey;
  renderRate();
  const isBracket = P.BRACKETS.some((b) => b.code === creator.statusCode);
  rs.set(creator.statusCode, isBracket ? 'bracket' : 'exact');
  if (!animated) {
    animated = true;
    $$('[data-spring]', dashView).forEach((el, i) => inview(el, ...rise(30), { tension: 190, friction: 26 }, (i % 2) * 90));
  }
  updatePreview();
  loadMine();
}

/* Creator-Key anzeigen / kopieren (für den Bot-Login) */
let keyVisible = false;
$('#keyShow').addEventListener('click', (e) => {
  keyVisible = !keyVisible;
  $('#keyText').textContent = keyVisible ? creds.creatorKey : '••••••••••••';
  e.target.textContent = keyVisible ? 'Verbergen' : 'Anzeigen';
});
$('#keyCopy').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(creds.creatorKey); e.target.textContent = 'Kopiert ✓'; }
  catch (_) { $('#keyText').textContent = creds.creatorKey; }
});

/* Steuersatz ändern */
$('#rateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#rateMsg');
  const err = rs.validate();
  if (err) return showMsg(msg, false, err);
  const btn = $('#rateBtn');
  setBusy(btn, true);
  try {
    const res = await T.updateStatus(creds, rs.rate);
    creator = res.creator;
    renderRate();
    updatePreview();
    showMsg(msg, true, `Gespeichert: ${T.pct(creator.statusCode)}. Der Telegram-Bot übernimmt den neuen Steuersatz automatisch.`);
  } catch (ex) {
    showMsg(msg, false, ex.message);
  } finally {
    setBusy(btn, false);
  }
});

/* Live-Preis: Einkaufspreis × Preisstufe, echter Verlust mit eigenem Steuersatz */
function updatePreview() {
  if (!creator) return;
  $('#resultLabel').textContent = `Dein Verkaufspreis · Stufe ${P.tier(tiers.value).label}`;
  const purchase = P.parseMoney(priceIn.value);
  const ok = isFinite(purchase) && purchase > 0 && purchase <= 100000;
  priceIn.setAttribute('aria-invalid', String(!ok && priceIn.value.trim() !== ''));
  tiers.update(ok ? purchase : NaN, creator.statusCode);
  if (!ok) {
    counter.set(null);
    $('#resultRows').innerHTML = '';
    $('#resultNote').textContent = priceIn.value.trim() ? 'Bitte nur eine Zahl eingeben, z. B. 27,90' : 'Gib deinen Einkaufspreis ein – Preis und echter Verlust werden live berechnet.';
    return;
  }
  const o = P.offer(purchase, tiers.value, creator.statusCode);
  counter.set(o.price);
  $('#resultRows').innerHTML = offerRowsHTML(o);
  $('#resultNote').textContent = LOSS_NOTE;
}
priceIn.addEventListener('input', updatePreview);
priceIn.addEventListener('blur', () => {
  const v = P.parseMoney(priceIn.value);
  if (isFinite(v) && v > 0) priceIn.value = v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

/* Web-Upload → neue Zeile im Google Sheet */
$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#productError');
  err.hidden = true;
  const urlOk = (v) => /^https?:\/\/\S+$/i.test(v);
  const shopLink = $('#shopLink').value.trim();
  const purchase = P.parseMoney(priceIn.value);
  const videoLink = $('#videoLink').value.trim();
  ['shopLink', 'videoLink'].forEach((id) => $('#' + id).setAttribute('aria-invalid', 'false'));
  const problems = [];
  if (!urlOk(shopLink)) { problems.push('TikTok Shop Produkt-Link'); $('#shopLink').setAttribute('aria-invalid', 'true'); }
  if (!(purchase > 0)) { problems.push('Einkaufspreis (reine Zahl)'); priceIn.setAttribute('aria-invalid', 'true'); }
  if (videoLink && !urlOk(videoLink)) { problems.push('TikTok-Video-Link'); $('#videoLink').setAttribute('aria-invalid', 'true'); }
  if (problems.length) { err.textContent = 'Bitte prüfe: ' + problems.join(', ') + '.'; err.hidden = false; return; }

  const btn = $('#productBtn');
  setBusy(btn, true);
  try {
    const tier = tiers.value;
    const res = await T.addProduct(creds, {
      shopLink, price: purchase, tier, videoLink, source: 'web',
      name: $('#pName').value.trim(), category: $('#pCat').value, description: $('#pDesc').value.trim(),
    });
    const o = P.offer(purchase, tier, creator.statusCode);
    const sheetPrice = typeof res.product.price === 'number' ? res.product.price : o.price;
    $('#resultLabel').textContent = `Hochgeladen ✓ Stufe ${o.tier.label}`;
    counter.set(sheetPrice);
    $('#resultRows').innerHTML = offerRowsHTML(o);
    $('#resultNote').textContent = 'Das Sample ist in deinem Konto gespeichert. Du kannst direkt das nächste hochladen.';
    e.target.reset();
    priceIn.addEventListener('input', updatePreview, { once: true });
    loadMine();
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
  } finally {
    setBusy(btn, false);
  }
});

/* Eigene Samples */
async function loadMine() {
  const list = $('#myList');
  try {
    const all = await T.getProducts();
    const mine = all.filter((p) => (p.userId || '').toLowerCase() === creator.userId.toLowerCase());
    $('#statCount').textContent = mine.length;
    $('#statTg').textContent = mine.filter((p) => p.source === 'Telegram').length;
    list.innerHTML = mine.length
      ? mine.map((p) => {
        const meta = [
          `Einkauf ${T.fmtEUR(p.purchasePrice ?? p.originalPrice)}`,
          p.tier ? `Stufe ${T.esc(p.tier)}` : '',
          p.source ? `via ${T.esc(p.source)}` : '',
        ].filter(Boolean).join(' · ');
        return `<li><span class="n">${T.esc(p.name || p.videoTitle || 'TikTok Shop Produkt')}</span>
          <span class="p">${T.fmtEUR(p.price)}</span><span class="meta">${meta}</span></li>`;
      }).join('')
      : '<li><span class="empty-li">Noch keine Samples. Lade dein erstes per Telegram hoch – oder hier im Web.</span></li>';
  } catch (err) {
    list.innerHTML = `<li><span class="empty-li">${T.esc(err.message)}</span></li>`;
  }
}

/* Automatischer Login mit gespeicherter Session */
const saved = T.session.get();
if (saved && saved.userId && saved.creatorKey) doLogin(saved).catch((err) => { T.session.clear(); showLogin(err.message); });
else showLogin();

bindMicro(document);
window.__pageReady = true;

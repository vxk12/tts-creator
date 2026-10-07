/* Stufe 2: Creator-Dashboard mit Web-Eingabemaske und Live-Preisberechnung. */
import { T, $, $$, Spring, tf, rise, inview, setReady } from './core.js';
import { renderChrome, bindMicro } from './store.js';
import { priceCounter, breakdownHTML, formulaText } from './pricing-ui.js';

renderChrome({ mode: 'creator' });
setReady();

const P = T.PRICING;
const loginView = $('#loginView'), dashView = $('#dashView');
let creds = null, creator = null;

const counter = priceCounter($('#resultPrice'));
const factorPct = (rate) => `${Math.round(P.factor(rate) * 100)}<em>%</em>`;

function setBusy(btn, busy) {
  if (!btn.__label) btn.__label = btn.innerHTML;
  btn.disabled = busy;
  btn.innerHTML = busy ? '<span class="spinner"></span>Bitte warten …' : btn.__label;
}
function reveal(el) { new Spring({ opacity: 0, y: 20 }, { tension: 220, friction: 26 }, tf(el)).to({ opacity: 1, y: 0 }); }

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
$('#logout').addEventListener('click', () => {
  T.session.clear(); creds = creator = null; $('#loginKey').value = ''; showLogin();
});

/* ---------- Dashboard ---------- */
function showDashboard() {
  loginView.hidden = true;
  dashView.hidden = false;
  reveal(dashView);
  $('#hello').textContent = 'Hi @' + creator.userId;
  $('#statRate').textContent = creator.statusCode.toFixed(2);
  $('#statFactor').innerHTML = factorPct(creator.statusCode);
  $('#noteUser').textContent = '@' + creator.userId;
  $('#noteRate').textContent = creator.statusCode.toFixed(2);
  $('#tgUser').value = creator.telegram || '';
  $('#botLink').href = T.telegramBotLink(creator.userId);
  $$('[data-spring]', dashView).forEach((el, i) => inview(el, ...rise(30), { tension: 190, friction: 26 }, i * 90));
  updatePreview();
  loadMine();
}

/* Live-Preis aus Einkaufspreis + Status_Code */
const priceIn = $('#price');
function updatePreview() {
  if (!creator) return;
  $('#resultLabel').textContent = 'Dein Schnäppchenpreis';
  const purchase = P.parseMoney(priceIn.value);
  const ok = isFinite(purchase) && purchase > 0 && purchase <= 100000;
  priceIn.setAttribute('aria-invalid', String(!ok && priceIn.value.trim() !== ''));
  if (!ok) {
    counter.set(null);
    $('#resultRows').innerHTML = '';
    $('#resultNote').textContent = priceIn.value.trim() ? 'Bitte nur eine Zahl eingeben, z. B. 27,90' : 'Gib deinen Einkaufspreis ein – der Preis wird live berechnet.';
    return;
  }
  const b = P.breakdown(purchase, creator.statusCode);
  counter.set(b.price);
  $('#resultRows').innerHTML = breakdownHTML(b);
  $('#resultNote').textContent = formulaText(creator.statusCode);
}
priceIn.addEventListener('input', updatePreview);
priceIn.addEventListener('blur', () => {
  const v = P.parseMoney(priceIn.value);
  if (isFinite(v) && v > 0) priceIn.value = v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

/* Web-Eingabemaske → neue Zeile im Google Sheet */
$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#productError');
  err.hidden = true;
  const fields = { shopLink: $('#shopLink'), price: priceIn, videoLink: $('#videoLink') };
  Object.values(fields).forEach((f) => f.setAttribute('aria-invalid', 'false'));
  const urlOk = (v) => /^https?:\/\/\S+$/i.test(v);
  const shopLink = fields.shopLink.value.trim();
  const purchase = P.parseMoney(priceIn.value);
  const videoLink = fields.videoLink.value.trim();
  const problems = [];
  if (!urlOk(shopLink)) { problems.push('TikTok Shop Produkt-Link'); fields.shopLink.setAttribute('aria-invalid', 'true'); }
  if (!(purchase > 0)) { problems.push('Einkaufspreis (reine Zahl)'); priceIn.setAttribute('aria-invalid', 'true'); }
  if (!urlOk(videoLink)) { problems.push('TikTok-Video-Link'); fields.videoLink.setAttribute('aria-invalid', 'true'); }
  if (problems.length) { err.textContent = 'Bitte prüfe: ' + problems.join(', ') + '.'; err.hidden = false; return; }

  const btn = $('#productBtn');
  setBusy(btn, true);
  try {
    const res = await T.addProduct(creds, {
      shopLink, price: purchase, videoLink,
      name: $('#pName').value.trim(), category: $('#pCat').value, description: $('#pDesc').value.trim(),
    });
    const p = res.product;
    const sheetPrice = typeof p.price === 'number' ? p.price : P.price(purchase, creator.statusCode);
    $('#resultLabel').textContent = 'Inseriert ✓ Preis laut Tabelle (Spalte H)';
    counter.set(sheetPrice);
    $('#resultRows').innerHTML = breakdownHTML(P.breakdown(purchase, creator.statusCode));
    $('#resultNote').textContent = 'Das Produkt ist gespeichert. Du kannst direkt das nächste einstellen.';
    e.target.reset();
    priceIn.addEventListener('input', () => { if ($('#resultLabel').textContent.startsWith('Inseriert')) updatePreview(); }, { once: true });
    loadMine();
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
  } finally {
    setBusy(btn, false);
  }
});

/* Telegram-Username */
$('#profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#profileMsg');
  const btn = $('#profileBtn');
  setBusy(btn, true);
  try {
    const res = await T.updateProfile(creds, $('#tgUser').value);
    creator = res.creator;
    $('#tgUser').value = creator.telegram;
    msg.className = 'alert--ok'; msg.textContent = 'Gespeichert.';
  } catch (ex) {
    msg.className = 'alert--error'; msg.style.marginTop = '1rem'; msg.textContent = ex.message;
  } finally {
    msg.hidden = false; setBusy(btn, false);
  }
});

/* Eigene Inserate */
async function loadMine() {
  const list = $('#myList');
  try {
    const all = await T.getProducts();
    const mine = all.filter((p) => (p.userId || '').toLowerCase() === creator.userId.toLowerCase());
    $('#statCount').textContent = mine.length;
    list.innerHTML = mine.length
      ? mine.map((p) => `<li><span class="n">${T.esc(p.name || p.videoTitle || 'TikTok Shop Produkt')}</span>
          <span class="p">${T.fmtEUR(p.price)}</span>
          <span class="meta">Einkauf ${T.fmtEUR(p.originalPrice)}${p.category ? ' · ' + T.esc(p.category) : ''}</span></li>`).join('')
      : '<li><span class="empty-li">Noch keine Inserate. Leg oben dein erstes Produkt an.</span></li>';
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

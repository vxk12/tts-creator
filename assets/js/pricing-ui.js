/* Bausteine rund um die Preisberechnung: Steuersatz-Auswahl, animierte Preisanzeige, Aufschlüsselung. */
import { T, $, $$, Spring, tf, RM } from './core.js';

const P = T.PRICING;

/**
 * Steuersatz-Auswahl wie im Onboarding:
 * „Kennst du deinen exakten Grenzsteuersatz?“ → JA: Eingabe in % · NEIN: 3 Einkommens-Buttons.
 * onChange(rate | null) wird bei jeder Änderung aufgerufen.
 */
export function rateSelector(root, { onChange = () => {}, initial = null, idPrefix = 'rs', question = true } = {}) {
  root.classList.add('rs');
  root.innerHTML = `
    ${question ? `<p class="rs__q" id="${idPrefix}-q">Kennst du deinen exakten Grenzsteuersatz?</p>` : ''}
    <div class="rs__yn" role="group" aria-label="Kennst du deinen exakten Grenzsteuersatz?">
      <button type="button" class="choice" data-knows="yes" aria-pressed="false">JA</button>
      <button type="button" class="choice" data-knows="no" aria-pressed="false">NEIN</button>
    </div>
    <div class="rs__panel rs__exact" hidden>
      <label class="rs__label" for="${idPrefix}-pct">Dein Grenzsteuersatz</label>
      <div class="rs__pct">
        <input id="${idPrefix}-pct" type="number" inputmode="decimal" min="0" max="${P.MAX_RATE_PERCENT}" step="0.1" placeholder="z. B. 35" autocomplete="off">
        <span>%</span>
      </div>
      <p class="rs__hint">Eingabe in Prozent – gespeichert wird die Dezimalzahl (35 % → 0.35).</p>
    </div>
    <div class="rs__panel rs__brackets" hidden>
      <p class="rs__label">Geschätztes Gesamteinkommen</p>
      <div class="rs__list">
        ${P.BRACKETS.map((b) => `<button type="button" class="choice choice--row" data-code="${b.code}" aria-pressed="false">
          <span>${b.label} <small>${b.sub}</small></span>
          <em>Steuersatz ca. ${T.pct(b.code)}</em></button>`).join('')}
      </div>
    </div>`;

  const yn = $$('[data-knows]', root), codes = $$('[data-code]', root);
  const exact = $('.rs__exact', root), brackets = $('.rs__brackets', root), input = $('input', root);
  const state = { knows: null, rate: null };

  const press = (list, btn) => list.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  const reveal = (el) => {
    if (!el.hidden) return;
    el.hidden = false;
    new Spring({ opacity: 0, y: 10 }, { tension: 260, friction: 24 }, tf(el)).to({ opacity: 1, y: 0 });
  };
  let quiet = false;
  const emit = () => { if (!quiet) onChange(state.rate); };

  function readExact() {
    const raw = String(input.value).replace(',', '.');
    const n = Number(raw);
    const ok = raw !== '' && isFinite(n) && n >= 0 && n <= P.MAX_RATE_PERCENT;
    input.setAttribute('aria-invalid', String(raw !== '' && !ok));
    state.rate = ok ? Math.round(n * 100) / 10000 : null;
  }
  function setKnows(knows, focus = true) {
    state.knows = knows;
    press(yn, yn.find((b) => b.dataset.knows === (knows ? 'yes' : 'no')));
    exact.hidden = true; brackets.hidden = true;
    if (knows) { reveal(exact); readExact(); if (focus) setTimeout(() => input.focus(), 60); }
    else { reveal(brackets); const sel = codes.find((b) => b.getAttribute('aria-pressed') === 'true'); state.rate = sel ? Number(sel.dataset.code) : null; }
    emit();
  }

  yn.forEach((b) => b.addEventListener('click', () => setKnows(b.dataset.knows === 'yes')));
  codes.forEach((b) => b.addEventListener('click', () => { press(codes, b); state.rate = Number(b.dataset.code); emit(); }));
  input.addEventListener('input', () => { readExact(); emit(); });

  const api = {
    get rate() { return state.rate; },
    get knows() { return state.knows; },
    /** Vorbelegen: mode 'exact' → Prozentfeld, 'bracket' → Einkommens-Button */
    set(rate, mode) {
      if (rate == null) return;
      if (mode === 'exact') { input.value = String(Math.round(rate * 10000) / 100); setKnows(true, false); }
      else {
        const btn = codes.find((b) => Number(b.dataset.code) === rate);
        if (btn) { press(codes, btn); setKnows(false, false); }
        else { input.value = String(Math.round(rate * 10000) / 100); setKnows(true, false); }
      }
    },
    validate() {
      if (state.knows === null) return 'Bitte wähle JA oder NEIN.';
      if (state.knows && state.rate === null) { input.setAttribute('aria-invalid', 'true'); return `Bitte gib deinen Grenzsteuersatz in Prozent ein (0–${P.MAX_RATE_PERCENT}).`; }
      if (!state.knows && state.rate === null) return 'Bitte wähle dein geschätztes Gesamteinkommen.';
      return '';
    },
    get mode() { return state.knows ? 'exact' : 'bracket'; },
  };
  // Vorbelegung ohne Callback – der Aufrufer rendert danach selbst
  if (initial) { quiet = true; api.set(initial.rate, initial.mode); quiet = false; }
  return api;
}

/** Preis mit Feder-Animation hochzählen lassen – endet immer exakt auf dem Zielwert */
export function priceCounter(el) {
  let shown = 0, target = null, snap = null;
  const render = (v) => { shown = v; el.textContent = T.fmtEUR(Math.max(0, target != null && Math.abs(v - target) < 0.05 ? target : v)); };
  const s = new Spring({ v: 0 }, { tension: 210, friction: 28 }, (x) => render(x.v));
  return {
    set(value, { instant = false } = {}) {
      clearTimeout(snap);
      if (value == null || !isFinite(value)) { target = null; s.set({ v: 0 }); el.textContent = '– €'; return; }
      target = value;
      if (instant || RM) { s.set({ v: value }); return; }
      s.to({ v: value });
      snap = setTimeout(() => s.set({ v: value }), 900);
    },
    get value() { return target ?? shown; },
  };
}

/**
 * Drei Preisstufen als Auswahlkarten (Fair / Schnell / Sofort weg).
 * update(purchase, rate) aktualisiert Preise + echten Verlust, onChange(tierId) bei Auswahl.
 */
export function tierPicker(root, { onChange = () => {}, initial = 'fair' } = {}) {
  root.classList.add('tiers');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Preisstufe');
  root.innerHTML = P.TIERS.map((t) => `<button type="button" class="tier" role="radio" data-tier="${t.id}" aria-checked="${t.id === initial}">
      <span class="tier__top"><b>${t.label}</b><small>${Math.round(t.factor * 100)} %</small></span>
      <span class="tier__price" data-price>–</span>
      <span class="tier__loss" data-loss>echter Verlust –</span>
    </button>`).join('');
  let current = initial;
  const btns = $$('[data-tier]', root);
  btns.forEach((b) => b.addEventListener('click', () => {
    current = b.dataset.tier;
    btns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    new Spring({ scale: 0.97 }, { tension: 420, friction: 18 }, tf(b)).to({ scale: 1 });
    onChange(current);
  }));
  return {
    get value() { return current; },
    update(purchase, rate) {
      btns.forEach((b) => {
        const ok = isFinite(purchase) && purchase > 0 && rate != null;
        const o = ok ? P.offer(purchase, b.dataset.tier, rate) : null;
        $('[data-price]', b).textContent = o ? T.fmtEUR(o.price) : '–';
        $('[data-loss]', b).textContent = o ? `echter Verlust ${T.fmtEUR(o.loss)}` : 'echter Verlust –';
      });
    },
  };
}

/** Aufschlüsselung eines Angebots als <dl> */
export function offerRowsHTML(o) {
  if (!o) return '';
  return `
    <dt>Einkaufspreis</dt><dd>${T.fmtEUR(o.purchase)}</dd>
    <dt>Verkaufspreis (${o.tier.label}, ${Math.round(o.tier.factor * 100)} %)</dt><dd>${T.fmtEUR(o.price)}</dd>
    <dt>Differenz</dt><dd>− ${T.fmtEUR(o.diff)}</dd>
    <dt>Steuerersparnis (${T.pct(o.rate)})</dt><dd>+ ${T.fmtEUR(o.taxSaving)}</dd>
    <dt class="strong">Echter Verlust nach Steuer</dt><dd class="strong">${T.fmtEUR(o.loss)}</dd>`;
}

export const LOSS_NOTE = 'Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz). Schätzung, keine Steuerberatung.';
export const RATE_DISCLAIMER = 'Die Einschätzung über dein Einkommen ist ein Näherungswert und nicht 100 % genau. Für das beste Ergebnis schau in deinem letzten Steuerbescheid nach – du kannst deinen Steuersatz jederzeit im Dashboard ändern.';

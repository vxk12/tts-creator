/* Such- & Kategorieseite: Filter, Sortierung, Ergebnisse, Creator-Seiten. */
import { T, $, $$, setReady } from './core.js';
import { renderChrome, loadProducts, dealCard, bindCards, bindMicro, discount, displayName } from './store.js';

renderChrome();
setReady();

const PAGE = 24;
const params = new URLSearchParams(location.search);
const state = {
  q: params.get('q') || '',
  cat: params.get('cat') || '',
  seller: params.get('seller') || '',
  price: params.get('price') || '',
  off: params.get('off') || '',
  video: params.get('video') === '1',
  sort: params.get('sort') || 'new',
  shown: PAGE,
};
let all = [];

const grid = $('#grid'), count = $('#count'), empty = $('#empty');

/* ---------- URL-Status ---------- */
function syncUrl() {
  const p = new URLSearchParams();
  ['q', 'cat', 'seller', 'price', 'off'].forEach((k) => state[k] && p.set(k, state[k]));
  if (state.video) p.set('video', '1');
  if (state.sort !== 'new') p.set('sort', state.sort);
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

/* ---------- Filtern ---------- */
function matches(p, { ignoreCat = false } = {}) {
  if (!ignoreCat && state.cat && p.category !== state.cat) return false;
  if (state.seller && (p.userId || '').toLowerCase() !== state.seller.toLowerCase()) return false;
  if (state.q) {
    const hay = `${displayName(p)} ${p.description || ''} ${p.userId} ${p.category}`.toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (state.price) {
    const [min, max] = state.price.split('-').map((v) => (v === '' ? null : Number(v)));
    if (min != null && p.price < min) return false;
    if (max != null && p.price > max) return false;
  }
  if (state.off && discount(p) < Number(state.off)) return false;
  if (state.video && !T.safeUrl(p.videoLink)) return false;
  return true;
}
const SORTERS = {
  new: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
  discount: (a, b) => discount(b) - discount(a),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
};

/* ---------- Rendern ---------- */
function renderHead() {
  let title = 'Alle Deals', eyebrow = 'Shop';
  if (state.seller) { title = `Deals von @${state.seller}`; eyebrow = 'Creator'; }
  else if (state.q) { title = `„${state.q}“`; eyebrow = state.cat ? `Suche in ${state.cat}` : 'Suchergebnisse'; }
  else if (state.cat) { title = state.cat; eyebrow = 'Kategorie'; }
  else if (state.sort === 'discount') { title = 'Größte Rabatte'; }
  else if (state.sort === 'new' && params.get('sort') === 'new') { title = 'Neu eingetroffen'; }
  $('#listTitle').textContent = title;
  $('#listEyebrow').textContent = eyebrow;
  document.title = `${title.replace(/[„“]/g, '')} – TTS Deals`;

  const crumbs = ['<a href="index.html">Start</a>', '<a href="shop.html">Alle Deals</a>'];
  if (state.cat) crumbs.push(`<a href="shop.html?cat=${encodeURIComponent(state.cat)}">${T.esc(state.cat)}</a>`);
  if (state.seller) crumbs.push(`<span aria-current="page">@${T.esc(state.seller)}</span>`);
  else if (state.q) crumbs.push(`<span aria-current="page">Suche</span>`);
  $('#crumbs').innerHTML = crumbs.join('<span>›</span>');
}

function renderFilters() {
  const base = all.filter((p) => matches(p, { ignoreCat: true }));
  const counts = base.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {});
  $('#fCat').innerHTML = '<legend>Kategorie</legend>' + ['', ...T.CATEGORIES].map((c) =>
    `<label class="fopt"><input type="radio" name="cat" value="${c}"${c === state.cat ? ' checked' : ''}> <span>${c || 'Alle Kategorien'}</span><small>${c ? counts[c] || 0 : base.length}</small></label>`).join('');
  $$('input[name="price"]').forEach((i) => { i.checked = i.value === state.price; });
  $$('input[name="off"]').forEach((i) => { i.checked = i.value === state.off; });
  $('#fVideo').checked = state.video;
  $('#sort').value = state.sort;

  const chips = [];
  if (state.q) chips.push(['q', `Suche: ${state.q}`]);
  if (state.seller) chips.push(['seller', `@${state.seller}`]);
  if (state.cat) chips.push(['cat', state.cat]);
  if (state.price) chips.push(['price', $(`input[name="price"][value="${state.price}"]`)?.nextElementSibling.textContent || state.price]);
  if (state.off) chips.push(['off', `Rabatt ab ${state.off} %`]);
  if (state.video) chips.push(['video', 'Mit Video-Nachweis']);
  $('#activeFilters').innerHTML = chips.map(([k, l]) =>
    `<button class="fchip" type="button" data-clear="${k}">${T.esc(l)}<svg><use href="#i-x"/></svg></button>`).join('');
  const n = chips.filter(([k]) => k !== 'q' && k !== 'seller').length;
  $('#filterCount').textContent = n ? n : '';
}

function render() {
  renderHead();
  renderFilters();
  const list = all.filter((p) => matches(p)).sort(SORTERS[state.sort] || SORTERS.new);
  grid.innerHTML = list.slice(0, state.shown).map(dealCard).join('');
  bindCards(grid, { perRow: 3 });
  count.textContent = `${list.length} ${list.length === 1 ? 'Ergebnis' : 'Ergebnisse'}`;
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.innerHTML = `<h3>Keine passenden Deals</h3><p>Versuch es mit weniger Filtern oder einem anderen Suchbegriff.</p>
      <button class="pill pill--light" type="button" data-reset>Filter zurücksetzen</button>`;
  }
  $('#moreWrap').hidden = list.length <= state.shown;
  syncUrl();
}

/* ---------- Events ---------- */
$('#filters').addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'cat') state.cat = t.value;
  if (t.name === 'price') state.price = t.value;
  if (t.name === 'off') state.off = t.value;
  if (t.id === 'fVideo') state.video = t.checked;
  state.shown = PAGE;
  render();
});
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
$('#more').addEventListener('click', () => { state.shown += PAGE; render(); });
function resetAll() {
  Object.assign(state, { cat: '', price: '', off: '', video: false, q: '', seller: '', shown: PAGE });
  const q = $('.sh__search input[name="q"]'); if (q) q.value = '';
  render();
}
$('#resetFilters').addEventListener('click', resetAll);
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-clear]');
  if (c) {
    const k = c.dataset.clear;
    state[k] = k === 'video' ? false : '';
    if (k === 'q') { const q = $('.sh__search input[name="q"]'); if (q) q.value = ''; }
    state.shown = PAGE;
    render();
  }
  if (e.target.closest('[data-reset]')) resetAll();
});

// Filter auf dem Handy eingeklappt starten
if (innerWidth < 1024) $('#filters').open = false;

/* ---------- Laden ---------- */
async function load() {
  grid.innerHTML = Array.from({ length: 6 }, () => `<li aria-hidden="true"><div class="deal deal--sk"><div class="deal__media"></div>
    <div class="deal__body"><div class="sk" style="width:80%"></div><div class="sk" style="width:45%;height:1.8rem"></div>
    <div class="sk" style="height:2.6rem;border-radius:99rem;margin-top:.5rem"></div></div></div></li>`).join('');
  try {
    all = await loadProducts();
  } catch (err) {
    grid.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = `<h3>Deals konnten nicht geladen werden</h3><p>${T.esc(err.message)}</p><button class="pill pill--light" type="button" id="retry">Erneut versuchen</button>`;
    $('#retry').onclick = () => { empty.hidden = true; load(); };
    return;
  }
  render();
  bindMicro(document);
}
load();
window.__pageReady = true;

/* Produktseite: Galerie mit TikTok-Video, Infos, Kaufbox, ähnliche Deals. */
import { T, $, $$, lenis, Spring, tf, rise, inview, hover, setReady } from './core.js';
import {
  renderChrome, loadProducts, carousel, railHTML, bindMicro, wish,
  discount, savings, displayName, imageOf, catImage, sellerUrl, videoIdOf,
} from './store.js';

renderChrome();
setReady();

const id = new URLSearchParams(location.search).get('id') || '';
const grid = $('#pdpGrid');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '–');

function notFound(msg) {
  $('#crumbs').innerHTML = '<a href="index.html">Start</a><span>›</span><a href="shop.html">Alle Deals</a>';
  grid.outerHTML = `<div class="pdp__empty"><span class="eyebrow">Hoppla</span><h1>${T.esc(msg)}</h1>
    <p>Vielleicht wurde der Deal bereits verkauft. Schau dir die anderen Angebote an.</p>
    <a class="pill pill--solid" href="shop.html">Alle Deals ansehen <span class="arr"><svg><use href="#i-arrow"/></svg></span></a></div>`;
  bindMicro(document);
}

function render(p, all) {
  const name = displayName(p);
  const off = discount(p);
  const save = savings(p);
  const video = T.safeUrl(p.videoLink);
  const vid = videoIdOf(p);
  const buy = T.buyLink(p);
  const shop = T.safeUrl(p.shopLink);
  const img = imageOf(p);

  document.title = `${name} – TTS Deals`;
  const md = document.querySelector('meta[name="description"]');
  if (md) md.content = `${name} für ${T.fmtEUR(p.price)} statt ${T.fmtEUR(p.originalPrice)} – wie neu, nur 1x für ein TikTok-Testvideo ausgepackt.`;

  $('#crumbs').innerHTML = ['<a href="index.html">Start</a>', '<a href="shop.html">Alle Deals</a>',
    `<a href="shop.html?cat=${encodeURIComponent(p.category)}">${T.esc(p.category)}</a>`,
    `<span aria-current="page">${T.esc(name)}</span>`].join('<span>›</span>');

  const bullets = [
    ['Zustand', 'Wie neu – nur 1x für ein TikTok-Testvideo ausgepackt.'],
    video && ['Video-Nachweis', 'Im Testvideo siehst du genau dieses Produkt, bevor du kaufst.'],
    ['Einzelstück', 'Du kaufst genau dieses Exemplar direkt vom Creator.'],
    ['Kauf über Telegram', `Bezahlung und Versand klärst du direkt mit ${p.userId ? '@' + T.esc(p.userId) : 'dem Creator'}.`],
    off && ['Preisvorteil', `${off} % unter dem Originalpreis aus dem TikTok Shop.`],
  ].filter(Boolean);

  const details = [
    ['Kategorie', `<a href="shop.html?cat=${encodeURIComponent(p.category)}">${T.esc(p.category)}</a>`],
    ['Zustand', 'Wie neu (1x ausgepackt)'],
    ['Originalpreis', p.originalPrice ? T.fmtEUR(p.originalPrice) : '–'],
    ['Plattform-Preis', T.fmtEUR(p.price)],
    save ? ['Ersparnis', `${T.fmtEUR(save)} (${off} %)`] : null,
    ['Verkäufer', p.userId ? `<a href="${sellerUrl(p.userId)}">@${T.esc(p.userId)}</a>` : '–'],
    ['Eingestellt am', fmtDate(p.createdAt)],
    ['Artikel-Nr.', T.esc(String(p.id).slice(0, 8).toUpperCase())],
    shop ? ['Originalangebot', `<a href="${T.esc(shop)}" target="_blank" rel="noopener noreferrer">Im TikTok Shop ansehen ↗</a>`] : null,
  ].filter(Boolean);

  grid.innerHTML = `
    <div class="gallery" data-spring>
      <div class="gallery__stage" id="stage">
        <img id="stageImg" src="${T.esc(img)}" alt="${T.esc(name)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${catImage(p.category)}'">
        <div class="gallery__video" id="stageVideo" hidden></div>
        ${off ? `<span class="deal__off gallery__off">−${off} %</span>` : ''}
        <button class="wish-btn gallery__wish" type="button" data-wish="${T.esc(p.id)}" aria-pressed="${wish.has(p.id)}" aria-label="Auf die Merkliste"><svg><use href="#i-heart"/></svg></button>
      </div>
      <div class="gallery__thumbs" role="tablist" aria-label="Ansicht">
        <button class="gthumb" type="button" role="tab" data-view="img" aria-selected="true"><img src="${T.esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${catImage(p.category)}'"></button>
        ${video ? `<button class="gthumb gthumb--video" type="button" role="tab" data-view="video" aria-selected="false"><img src="${T.esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${catImage(p.category)}'"><span><svg><use href="#i-play"/></svg>Video</span></button>` : ''}
      </div>
      ${video ? '<p class="gallery__hint">Tippe auf „Video“, um das Testvideo direkt hier anzusehen.</p>' : ''}
    </div>

    <div class="pinfo">
      <div data-spring>
        <a class="eyebrow" href="shop.html?cat=${encodeURIComponent(p.category)}">${T.esc(p.category)}</a>
        <h1 class="pinfo__title">${T.esc(name)}</h1>
        ${p.userId ? `<p class="pinfo__seller">Verkauft von <a href="${sellerUrl(p.userId)}">@${T.esc(p.userId)}</a> · <a href="${sellerUrl(p.userId)}">Alle Deals des Creators</a></p>` : ''}
        <div class="pinfo__badges">
          <span class="pbadge pbadge--ok"><svg><use href="#i-check"/></svg>Wie neu</span>
          <span class="pbadge">Einzelstück</span>
          ${video ? '<span class="pbadge"><svg><use href="#i-play"/></svg>Video-Nachweis</span>' : ''}
        </div>
      </div>

      <div class="pinfo__pricebox" data-spring>
        <div class="pinfo__price">${off ? `<span class="pinfo__off">−${off} %</span>` : ''}<b class="tag-price tag-price--lg">${T.fmtEUR(p.price)}</b></div>
        ${p.originalPrice ? `<p class="pinfo__was">Originalpreis: <s>${T.fmtEUR(p.originalPrice)}</s>${save ? ` · Du sparst <b>${T.fmtEUR(save)}</b>` : ''}</p>` : ''}
      </div>

      <div data-spring>
        <h2 class="pinfo__h">Über diesen Artikel</h2>
        <ul class="pinfo__bullets">${bullets.map(([b, t]) => `<li><svg><use href="#i-check"/></svg><span><b>${b}:</b> ${t}</span></li>`).join('')}</ul>
        ${p.description ? `<p class="pinfo__desc">${T.esc(p.description).replace(/\n/g, '<br>')}</p>` : ''}
      </div>

      <div class="acc" data-spring>
        <details open>
          <summary>Produktdetails<svg><use href="#i-chevron"/></svg></summary>
          <dl class="ptable">${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        </details>
        <details>
          <summary>Kauf &amp; Versand<svg><use href="#i-chevron"/></svg></summary>
          <ol class="psteps">
            <li><b>„Jetzt kaufen“ tippen</b><span>Du landest im privaten Telegram-Chat von ${p.userId ? '@' + T.esc(p.userId) : 'dem Creator'}.</span></li>
            <li><b>Deal abstimmen</b><span>Nenne das Produkt – Bezahlung und Versand klärt ihr direkt miteinander.</span></li>
            <li><b>Auspacken &amp; freuen</b><span>Du bekommst das Produkt im Zustand aus dem Testvideo.</span></li>
          </ol>
        </details>
      </div>
    </div>

    <aside class="buybox" id="buybox" data-spring aria-label="Kaufen">
      <div class="buybox__price"><b>${T.fmtEUR(p.price)}</b>${p.originalPrice ? `<s>${T.fmtEUR(p.originalPrice)}</s>` : ''}</div>
      ${save ? `<p class="buybox__save">Du sparst ${T.fmtEUR(save)} (${off} %)</p>` : ''}
      <ul class="buybox__facts">
        <li><svg><use href="#i-check"/></svg>Zustand: Wie neu – nur 1x für Video ausgepackt</li>
        <li><svg><use href="#i-check"/></svg>Einzelstück – nur 1x verfügbar</li>
        <li><svg><use href="#i-shield"/></svg>Direkt vom TikTok Shop Creator</li>
      </ul>
      <div class="buybox__actions">
        <a class="btn-deal btn-deal--buy btn-deal--lg" href="${T.esc(buy)}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-send"/></svg>Jetzt kaufen via Telegram</a>
        ${video ? `<button class="btn-deal btn-deal--video btn-deal--lg" type="button" id="watchVideo"><svg><use href="#i-play"/></svg>Video-Nachweis ansehen</button>` : ''}
        <div class="buybox__row">
          <button class="btn-ghost" type="button" data-wish="${T.esc(p.id)}" aria-pressed="${wish.has(p.id)}"><svg><use href="#i-heart"/></svg><span class="on">Gemerkt</span><span class="off">Merken</span></button>
          <button class="btn-ghost" type="button" id="share"><svg><use href="#i-share"/></svg>Teilen</button>
        </div>
      </div>
      <dl class="buybox__meta">
        <dt>Verkäufer</dt><dd>${p.userId ? `<a href="${sellerUrl(p.userId)}">@${T.esc(p.userId)}</a>` : 'Creator'}</dd>
        <dt>Kauf über</dt><dd>Telegram-Chat</dd>
        <dt>Bezahlung &amp; Versand</dt><dd>Direkt mit dem Creator</dd>
      </dl>
    </aside>`;

  // Mobile Kaufleiste
  const bar = $('#buybar');
  bar.innerHTML = `<div class="buybar__price"><b>${T.fmtEUR(p.price)}</b>${p.originalPrice ? `<s>${T.fmtEUR(p.originalPrice)}</s>` : ''}</div>
    <a class="btn-deal btn-deal--buy" href="${T.esc(buy)}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-send"/></svg>Jetzt kaufen</a>`;
  bar.hidden = false;
  const barS = new Spring({ y: 120 }, { tension: 260, friction: 28 }, tf(bar));
  new IntersectionObserver(([e]) => barS.to({ y: e.isIntersecting ? 120 : 0 }))
    .observe($('.buybox__actions'));

  // Galerie: Bild ↔ TikTok-Video
  const stage = $('#stage');
  function showView(view) {
    $$('.gthumb').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    const isVideo = view === 'video';
    if (isVideo && !vid) { window.open(video, '_blank', 'noopener'); return; }
    stage.classList.toggle('is-video', isVideo);
    $('#stageImg').hidden = isVideo;
    const box = $('#stageVideo');
    box.hidden = !isVideo;
    if (isVideo && !box.firstChild) {
      box.innerHTML = `<iframe src="https://www.tiktok.com/player/v1/${encodeURIComponent(vid)}?description=1&rel=0&music_info=0" title="TikTok-Testvideo" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    const fade = new Spring({ opacity: 0.4, scale: 0.98 }, { tension: 260, friction: 24 }, tf(isVideo ? box : $('#stageImg')));
    fade.to({ opacity: 1, scale: 1 });
  }
  $$('.gthumb').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  const watch = $('#watchVideo');
  if (watch) watch.addEventListener('click', () => {
    showView('video');
    if (vid) lenis.scrollTo(stage, { offset: -24, duration: 1 });
  });

  // Teilen
  $('#share').addEventListener('click', async () => {
    const data = { title: name, text: `${name} für ${T.fmtEUR(p.price)} auf TTS Deals`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('Link kopiert'); }
    } catch (_) { /* abgebrochen */ }
  });

  // Animationen
  inview($('.gallery'), { opacity: 0, y: 30, scale: 0.98 }, { opacity: 1, y: 0, scale: 1 }, { tension: 190, friction: 26 });
  $$('.pinfo > [data-spring]').forEach((el, i) => inview(el, ...rise(24), { tension: 200, friction: 26 }, 80 + i * 70));
  inview($('#buybox'), ...rise(30), { tension: 190, friction: 26 }, 160);
  hover(stage, $('#stageImg'), { scale: 1 }, { scale: 1.03 }, { tension: 300, friction: 22 });

  // Ähnliche Deals & mehr vom Creator
  const others = all.filter((x) => String(x.id) !== String(p.id));
  let similar = others.filter((x) => x.category === p.category);
  if (similar.length < 3) similar = [...similar, ...others.filter((x) => x.category !== p.category).sort((a, b) => discount(b) - discount(a))];
  if (similar.length) {
    const r = $('#railSimilar');
    r.hidden = false;
    r.innerHTML = railHTML(`Ähnliche Deals in ${T.esc(p.category)}`, `shop.html?cat=${encodeURIComponent(p.category)}`);
    carousel(r, similar.slice(0, 12));
  }
  const fromSeller = p.userId ? others.filter((x) => (x.userId || '').toLowerCase() === p.userId.toLowerCase()) : [];
  if (fromSeller.length) {
    const r = $('#railSeller');
    r.hidden = false;
    r.innerHTML = railHTML(`Mehr von @${T.esc(p.userId)}`, sellerUrl(p.userId), 'Alle Deals des Creators');
    carousel(r, fromSeller.slice(0, 12));
  }
  bindMicro(document);
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
}

(async () => {
  if (!id) return notFound('Kein Produkt ausgewählt');
  let all;
  try { all = await loadProducts(); } catch (e) { return notFound('Deal konnte nicht geladen werden'); }
  const p = all.find((x) => String(x.id) === id);
  if (!p) return notFound('Dieser Deal ist nicht mehr verfügbar');
  render(p, all);
})();
window.__pageReady = true;

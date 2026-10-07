/* Gemeinsamer Motion-Kern aller Shop-Seiten:
   adaptives rem-Raster, Lenis Smooth Scroll, Mini-Springs, Reveals, Parallax. */
export const T = window.TTS;
export const html = document.documentElement;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const hoverOK = () => innerWidth > 768;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- Adaptives rem-Raster (Scale-up > 1920px) ---------------- */
function fitRoot() {
  const FONT_BASE = 16, BASE_W = 1920, COEF = 0.6666;
  const reduction = ((BASE_W - innerWidth) / BASE_W) * 100 * COEF;
  const size = FONT_BASE - (FONT_BASE * reduction) / 100;
  if (size > FONT_BASE) html.style.fontSize = size + 'px';
  else html.style.removeProperty('font-size');
}
fitRoot();
addEventListener('resize', fitRoot);

/* ---------------- Lenis (Smooth Scroll) ---------------- */
export let lenis;
try {
  const { default: Lenis } = await import('lenis');
  lenis = new Lenis({ smoothWheel: true });
} catch (_) {
  // Fallback, falls das CDN nicht erreichbar ist
  lenis = {
    raf() {}, stop() {}, start() {}, on() {}, resize() {},
    get scroll() { return scrollY; },
    scrollTo(t) {
      if (typeof t === 'number') return scrollTo({ top: t, behavior: 'smooth' });
      const el = typeof t === 'string' ? $(t) : t;
      (el || document.body).scrollIntoView({ behavior: 'smooth' });
    },
  };
}
let locks = 0;
export const lock = () => { if (locks++ === 0) { lenis.stop(); html.classList.add('is-locked'); } };
export const unlock = () => { if (locks > 0 && --locks === 0) { html.classList.remove('is-locked'); lenis.start(); } };

/* ---------------- Mini-Spring (tension/friction wie react-spring) ---------------- */
const active = new Set();
const SMALL = new Set(['opacity', 'scale']);
export class Spring {
  constructor(init, cfg, apply) {
    this.x = { ...init }; this.t = { ...init }; this.v = {};
    for (const k in init) this.v[k] = 0;
    this.cfg = { tension: 170, friction: 26, ...cfg };
    this.apply = apply;
    apply(this.x);
  }
  to(target, cfg) {
    if (cfg) this.cfg = { ...this.cfg, ...cfg };
    for (const k in target) { if (!(k in this.x)) { this.x[k] = target[k]; this.v[k] = 0; } this.t[k] = target[k]; }
    if (RM) { Object.assign(this.x, this.t); this.apply(this.x); return this; }
    active.add(this);
    return this;
  }
  set(vals) {
    Object.assign(this.x, vals); Object.assign(this.t, vals);
    for (const k in vals) this.v[k] = 0;
    active.delete(this); this.apply(this.x);
    return this;
  }
  step(dt) {
    const { tension, friction } = this.cfg;
    const n = Math.max(1, Math.round(dt * 1000)); const h = dt / n;
    let moving = false;
    for (const k in this.t) {
      let x = this.x[k], v = this.v[k] || 0; const tg = this.t[k];
      for (let i = 0; i < n; i++) { v += (-tension * (x - tg) - friction * v) * h; x += v * h; }
      const eps = SMALL.has(k) ? 0.0005 : 0.01;
      if (Math.abs(x - tg) < eps && Math.abs(v) < eps * 10) { x = tg; v = 0; } else moving = true;
      this.x[k] = x; this.v[k] = v;
    }
    this.apply(this.x);
    if (!moving) active.delete(this);
  }
}
export const tf = (el) => (s) => {
  if ('opacity' in s) el.style.opacity = s.opacity;
  el.style.transform = `translate3d(${s.x || 0}px,${s.y || 0}px,0) scale(${s.scale ?? 1}) rotate(${s.rotate || 0}deg)`;
};
export const rise = (y) => [{ opacity: 0, y }, { opacity: 1, y: 0 }];

/* ---------------- Ready-Gate (Loader auf der Startseite) ---------------- */
let ready = false;
const readyQueue = [];
export const whenReady = (fn) => (ready ? fn() : readyQueue.push(fn));
export function setReady() { if (ready) return; ready = true; readyQueue.splice(0).forEach((fn) => fn()); }

/* ---------------- Inview / Hover ---------------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); (e.target.__onView || []).splice(0).forEach((fn) => fn()); }
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
export const onView = (el, fn) => { (el.__onView ||= []).push(fn); io.observe(el); };
const gate = (gated) => (gated ? whenReady : (f) => f());

export function inview(el, from, to, cfg, delay = 0, gated = false) {
  const s = new Spring(from, cfg, tf(el));
  onView(el, () => gate(gated)(() => setTimeout(() => s.to(to), delay)));
  return s;
}
export function hover(trigger, target, from, to, cfg, apply) {
  const s = new Spring(from, cfg, apply || tf(target));
  trigger.addEventListener('pointerenter', () => { if (hoverOK()) s.to(to); });
  trigger.addEventListener('pointerleave', () => s.to(from));
  return s;
}

/* ---------------- Text-Reveals (Clip-Maske) ---------------- */
export function stackedLines(el, { stagger = 120, delay = 0, duration = 950, gated = false } = {}) {
  const lines = (el.dataset.lines || el.textContent).split('|');
  el.setAttribute('aria-label', lines.join(' '));
  el.innerHTML = lines.map((l, i) =>
    `<span class="clip line" aria-hidden="true"><span style="--d:${duration}ms;--delay:${delay + i * stagger}ms">${T.esc(l)}</span></span>`).join('');
  onView(el, () => gate(gated)(() => el.classList.add('is-in')));
}
export function words(el, { stagger = 140, duration = 1100, gated = false } = {}) {
  const ws = (el.dataset.words || el.textContent).trim().split(/\s+/);
  el.setAttribute('aria-label', ws.join(' '));
  el.innerHTML = ws.map((w, i) =>
    `<span class="clip" aria-hidden="true"><span style="--d:${duration}ms;--delay:${i * stagger}ms">${T.esc(w)}</span></span>`).join(' ');
  onView(el, () => gate(gated)(() => el.classList.add('is-in')));
}
export function fadeWords(el, { stagger = 28, delay = 250 } = {}) {
  const ws = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', ws.join(' '));
  el.innerHTML = ws.map((w, i) => `<span class="fade-w" aria-hidden="true" style="--delay:${delay + i * stagger}ms">${T.esc(w)}</span>`).join(' ');
  onView(el, () => el.classList.add('is-in'));
}
export function refire(clipEl, text) {
  clipEl.classList.remove('is-in');
  clipEl.firstElementChild.textContent = text;
  void clipEl.offsetWidth;
  clipEl.classList.add('is-in');
}
export function renderDots(box, n, idx, onPick) {
  box.innerHTML = Array.from({ length: n }, (_, i) =>
    `<button type="button" aria-label="${i + 1} von ${n}" aria-current="${i === idx}"><i></i></button>`).join('');
  $$('button', box).forEach((b, i) => b.addEventListener('click', () => onPick(i)));
}

/* ---------------- Parallax ---------------- */
const parallax = [];
export function addParallax(el, section, axis, from, to) { parallax.push({ el, section, axis, from, to }); }
function updateParallax() {
  const vh = innerHeight;
  for (const p of parallax) {
    const r = p.section.getBoundingClientRect();
    if (r.bottom < -50 || r.top > vh + 50) continue;
    const prog = clamp((vh - r.top) / (vh + r.height), 0, 1);
    const v = p.from + (p.to - p.from) * prog;
    p.el.style.transform = p.axis === 'y' ? `translate3d(0,${v}%,0)` : `translate3d(${v}%,0,0)`;
  }
}

/* ---------------- Haupt-Loop ---------------- */
const frameHooks = [];
export const onFrame = (fn) => frameHooks.push(fn);
let last = performance.now();
function frame(t) {
  lenis.raf(t);
  const dt = Math.min((t - last) / 1000, 1 / 20); last = t;
  for (const s of active) s.step(dt);
  updateParallax();
  for (const fn of frameHooks) fn(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* Anker-Links auf derselben Seite → Lenis */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  const norm = (p) => p.replace(/index\.html$/, '');
  if (norm(url.pathname) !== norm(location.pathname) || !url.hash || url.hash === '#') return;
  const target = $(url.hash);
  if (!target) return;
  e.preventDefault();
  document.dispatchEvent(new CustomEvent('tts:navigate', { detail: { link: a } }));
  requestAnimationFrame(() => { lenis.resize && lenis.resize(); lenis.scrollTo(target, { offset: 0, duration: 1.2 }); });
});

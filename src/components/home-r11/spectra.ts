/**
 * PROTOTYPE（首页第十一轮）：光谱型的星图、光谱和星表（Spectra.astro）。
 * - 画星图：各型的分界圆、四个天区、系列连线、星（黑体色，一样大）、三级名字
 * - 光谱：指着一颗星（或星表里的一行），下面换成它的光谱，读出光谱型、色温和封面主色；没指着时是太阳
 * - 缩放、拖动；键盘：星图只占一个 Tab 位置，方向键按从热到冷走
 * - 打开时星从最热的里圈往外亮起来（减少动态效果时直接全亮）
 */
import { CENTER, RADIUS, SIZE } from '../../lib/star-chart-frame';
import { dateLabel, kelvin, loadEntries, sampleMode } from './data';
import { bandEdge, layout, LEVELS, STAR_R, type Star } from './layout';
import { classify, drawSpectrum, LINES, VISIBLE } from './spectrum';

const SVG = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const LABEL: Record<string, string> = { games: '游戏', 'visual-novels': '视觉小说', anime: '动画', songs: '音乐' };
const SUN_T = 5772;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}
const f1 = (n: number) => n.toFixed(1);

export function mountSpectra(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-sp]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-sky]')!;
  const read = root.querySelector<HTMLElement>('[data-read]')!;
  const strip = root.querySelector<HTMLCanvasElement>('[data-strip]')!;
  const lineMarks = root.querySelector<HTMLElement>('[data-lines]')!;
  const still = reduced.matches;
  const offs: (() => void)[] = [];
  const on = (target: EventTarget, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    offs.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  const entries = loadEntries();
  const { stars, lines, regions, rings } = layout(entries);
  const byHeat = [...stars].sort((a, b) => b.e.T - a.e.T);

  // ---------- 星图 ----------
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  const defs = el('defs', {}, svg);
  const glow = el('filter', { id: 'sp-glow', x: '-1', y: '-1', width: '3', height: '3' }, defs);
  el('feGaussianBlur', { stdDeviation: 4 }, glow);
  const clip = el('clipPath', { id: 'sp-disc' }, defs);
  el('circle', { cx: CENTER, cy: CENTER, r: RADIUS }, clip);
  const sky = el('g', { 'clip-path': 'url(#sp-disc)' }, svg);
  for (const ring of rings) el('circle', { cx: CENTER, cy: CENTER, r: f1(ring.r), class: 'ring' }, sky);
  for (let k = 0; k < 4; k++) {
    const a = (k * 90 * Math.PI) / 180;
    el('line', { x1: CENTER + Math.cos(a) * 30, y1: CENTER + Math.sin(a) * 30, x2: CENTER + Math.cos(a) * RADIUS, y2: CENTER + Math.sin(a) * RADIUS, class: 'divider' }, sky);
  }
  // 各型的字母：写在正上方那道缝里，每一型那一圈带子的正中
  const bands = [bandEdge(0), ...rings.map((r) => r.r), bandEdge(7)];
  'OBAFGKM'.split('').forEach((cls, i) => {
    const r = (bands[i] + bands[i + 1]) / 2;
    const t = el('text', { x: CENTER, y: f1(CENTER - r), class: 'ring-label' }, sky);
    t.textContent = cls;
  });
  for (const r of regions) {
    const x = CENTER + Math.cos(r.ang) * 430;
    const y = CENTER + Math.sin(r.ang) * 430;
    const t = el('text', { x: f1(x), y: f1(y), 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'region', role: 'button', tabindex: 0, 'data-zoom-to': `${f1(r.fx)},${f1(r.fy)}`, 'aria-label': `放大到${LABEL[r.cat]}` }, sky);
    t.textContent = LABEL[r.cat];
  }
  const lineG = el('g', { class: 'lines' }, sky);
  for (const [a, b] of lines) el('line', { x1: f1(a.x), y1: f1(a.y), x2: f1(b.x), y2: f1(b.y) }, lineG);
  const starG = el('g', {}, sky);
  const starEls = new Map<Star, SVGAElement>();
  for (const s of byHeat) {
    const a = el('a', { href: s.e.href, class: 'star', 'aria-label': `${s.e.title}，${s.e.type} 型`, 'data-key': s.e.key }, starG);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: 11, class: 'hit' }, a);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: STAR_R * 1.8, fill: s.e.star, class: 'glow', filter: 'url(#sp-glow)' }, a);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: STAR_R, fill: s.e.star, class: 'dot' }, a);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: STAR_R + 5, stroke: s.e.star, class: 'halo' }, a);
    for (const level of LEVELS) {
      const l = s.labels[level];
      if (!l) continue;
      const t = el('text', { x: f1(l.x), y: f1(l.y), 'text-anchor': l.anchor, class: `l${level}`, 'aria-hidden': 'true' }, a);
      if (s.e.lang) t.setAttribute('lang', s.e.lang);
      t.textContent = s.e.title;
    }
    a.style.setProperty('--at', `${(0.2 + (Math.hypot(s.x - CENTER, s.y - CENTER) / RADIUS) * 1.6).toFixed(2)}s`);
    starEls.set(s, a);
  }
  el('circle', { cx: CENTER, cy: CENTER, r: RADIUS, class: 'rim' }, svg);

  // ---------- 星表：按光谱型分组，组里从热到冷 ----------
  for (const section of root.querySelectorAll<HTMLElement>('[data-groups] section')) {
    const ol = section.querySelector('ol')!;
    ol.replaceChildren();
    const mine = byHeat.filter((s) => s.e.cls === section.dataset.cls);
    section.toggleAttribute('data-empty', mine.length === 0);
    for (const s of mine) {
      const li = document.createElement('li');
      li.dataset.key = s.e.key;
      li.style.setProperty('--star', s.e.star);
      li.innerHTML = '<span class="type"></span><a></a><span class="cat"></span>';
      li.querySelector('.type')!.innerHTML = `<i>${s.e.cls}</i>${s.e.sub}`;
      const a = li.querySelector('a')!;
      a.href = s.e.href;
      a.textContent = s.e.title;
      if (s.e.lang) a.lang = s.e.lang;
      li.querySelector('.cat')!.textContent = s.e.categoryLabel;
      ol.append(li);
    }
  }

  // ---------- 光谱 ----------
  const scaleStrip = () => {
    const w = Math.max(Math.round(strip.clientWidth * Math.min(devicePixelRatio, 2)), 200);
    if (strip.width !== w) strip.width = w;
  };
  const showSpectrum = (T: number) => {
    scaleStrip();
    drawSpectrum(strip, T);
    // 这一型最明显的几条线，标上名字
    const { cls } = classify(T);
    lineMarks.replaceChildren();
    const [a, b] = VISIBLE;
    for (const l of LINES) {
      if (!l.name || (l.depth[cls] ?? 0) < 0.3) continue;
      const span = document.createElement('span');
      span.style.left = `${(((l.nm - a) / (b - a)) * 100).toFixed(2)}%`;
      span.textContent = l.name;
      lineMarks.append(span);
    }
  };
  const idle = () => {
    read.replaceChildren();
    const b = document.createElement('b');
    b.textContent = '太阳';
    read.append(b, `G2　${kelvin(SUN_T)}　没指着星的时候，这里是太阳的光谱`);
    showSpectrum(SUN_T);
  };
  const lit: Element[] = [];
  const clear = () => {
    for (const x of lit) x.classList.remove('lit');
    lit.length = 0;
    delete svg.dataset.lit;
    idle();
  };
  const light = (key: string | undefined) => {
    const s = stars.find((t) => t.e.key === key);
    for (const x of lit) x.classList.remove('lit');
    lit.length = 0;
    if (!s) return clear();
    for (const x of root.querySelectorAll(`[data-key="${CSS.escape(s.e.key)}"]`)) {
      x.classList.add('lit');
      lit.push(x);
    }
    svg.dataset.lit = '';
    read.replaceChildren();
    const b = document.createElement('b');
    b.textContent = s.e.title;
    if (s.e.lang) b.lang = s.e.lang;
    const cover = document.createElement('span');
    cover.className = 'sw';
    cover.style.background = s.e.cover;
    const star = document.createElement('span');
    star.className = 'sw';
    star.style.background = s.e.star;
    read.append(b, `${s.e.type}　${kelvin(s.e.T)}`, cover, '封面', star, `星色　${s.e.categoryLabel}　${dateLabel(s.e.date)}`);
    showSpectrum(s.e.T);
  };
  const keyOf = (t: EventTarget | null) => (t as Element | null)?.closest?.<HTMLElement | SVGElement>('[data-key]')?.dataset.key;
  on(svg, 'pointerover', (e: PointerEvent) => {
    const k = keyOf(e.target);
    if (k) light(k);
  });
  on(svg, 'pointerout', (e: PointerEvent) => {
    if (keyOf(e.target) && !keyOf(e.relatedTarget)) clear();
  });
  on(svg, 'focusin', (e: FocusEvent) => light(keyOf(e.target)));
  on(svg, 'focusout', clear);
  const groups = root.querySelector<HTMLElement>('[data-groups]')!;
  on(groups, 'pointerover', (e: PointerEvent) => {
    const k = keyOf(e.target);
    if (k) light(k);
  });
  on(groups, 'pointerleave', clear);
  on(groups, 'focusin', (e: FocusEvent) => light(keyOf(e.target)));
  on(groups, 'focusout', clear);
  idle();
  const ro = new ResizeObserver(() => (lit.length ? light(keyOf(lit[0])) : showSpectrum(SUN_T)));
  ro.observe(strip);

  // ---------- 打开时 ----------
  if (!still) {
    svg.dataset.dark = '';
    requestAnimationFrame(() => requestAnimationFrame(() => delete svg.dataset.dark));
  }
  const settled = window.setTimeout(() => {
    for (const a of starEls.values()) a.style.removeProperty('--at');
  }, still ? 0 : 3000);

  // ---------- 缩放和拖动 ----------
  let view = { z: 1, cx: CENTER, cy: CENTER };
  let anim = 0;
  const Z_MAX = 4;
  const zoomIn = root.querySelector<HTMLButtonElement>('[data-zoom="in"]')!;
  const zoomOut = root.querySelector<HTMLButtonElement>('[data-zoom="out"]')!;
  const clampView = (v: typeof view) => {
    const z = Math.min(Math.max(v.z, 1), Z_MAX);
    const half = CENTER / z;
    return { z, cx: Math.min(Math.max(v.cx, half), SIZE - half), cy: Math.min(Math.max(v.cy, half), SIZE - half) };
  };
  const apply = (v: typeof view) => {
    const w = SIZE / v.z;
    svg.setAttribute('viewBox', `${(v.cx - w / 2).toFixed(2)} ${(v.cy - w / 2).toFixed(2)} ${w.toFixed(2)} ${w.toFixed(2)}`);
    svg.style.setProperty('--zs', v.z.toFixed(3));
    svg.style.touchAction = v.z > 1.001 ? 'none' : '';
    const lod = v.z < 1.6 ? 1 : v.z < 3.2 ? 2 : 4;
    svg.dataset.lod = String(lod);
    svg.style.setProperty('--lod', String(lod));
    zoomIn.disabled = v.z >= Z_MAX - 0.001;
    zoomOut.disabled = v.z <= 1.001;
  };
  const go = (target: typeof view) => {
    target = clampView(target);
    cancelAnimationFrame(anim);
    if (still) {
      view = target;
      apply(view);
      return;
    }
    const from = { ...view };
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / 450, 1);
      const k = 1 - Math.pow(1 - t, 3);
      view = {
        z: Math.exp(Math.log(from.z) + (Math.log(target.z) - Math.log(from.z)) * k),
        cx: from.cx + (target.cx - from.cx) * k,
        cy: from.cy + (target.cy - from.cy) * k,
      };
      apply(view);
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  };
  apply(view);
  const toChart = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!.inverse());
  on(svg, 'wheel', (e: WheelEvent) => {
    e.preventDefault();
    const p = toChart(e.clientX, e.clientY);
    const z = Math.min(Math.max(view.z * Math.exp(-e.deltaY * 0.0018), 1), Z_MAX);
    const k = view.z / z;
    view = clampView({ z, cx: p.x + (view.cx - p.x) * k, cy: p.y + (view.cy - p.y) * k });
    cancelAnimationFrame(anim);
    apply(view);
  }, { passive: false });
  on(zoomIn, 'click', () => go({ ...view, z: Math.pow(2, Math.round(Math.log2(view.z)) + 1) }));
  on(zoomOut, 'click', () => {
    const z = Math.pow(2, Math.round(Math.log2(view.z)) - 1);
    go(z <= 1 ? { z: 1, cx: CENTER, cy: CENTER } : { ...view, z });
  });
  let drag: { x: number; y: number; cx: number; cy: number } | undefined;
  on(svg, 'pointerdown', (e: PointerEvent) => {
    if ((e.target as Element).closest('.star, [data-zoom-to]') || view.z <= 1.001) return;
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    svg.setPointerCapture(e.pointerId);
  });
  on(svg, 'pointermove', (e: PointerEvent) => {
    if (!drag) return;
    const scale = SIZE / view.z / svg.getBoundingClientRect().width;
    view = clampView({ z: view.z, cx: drag.cx - (e.clientX - drag.x) * scale, cy: drag.cy - (e.clientY - drag.y) * scale });
    apply(view);
  });
  const endDrag = () => (drag = undefined);
  on(svg, 'pointerup', endDrag);
  on(svg, 'pointercancel', endDrag);
  for (const t of svg.querySelectorAll<SVGTextElement>('[data-zoom-to]')) {
    const [cx, cy] = t.dataset.zoomTo!.split(',').map(Number);
    const focus = () => go({ z: 2, cx, cy });
    on(t, 'click', focus);
    on(t, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focus();
      }
    });
  }

  // ---------- 键盘：一个 Tab 位置，方向键从热到冷 ----------
  const links = byHeat.map((s) => starEls.get(s)!);
  const rove = (i: number) => links.forEach((a, j) => a.setAttribute('tabindex', i === j ? '0' : '-1'));
  rove(0);
  on(svg, 'keydown', (e: KeyboardEvent) => {
    const at = links.indexOf((e.target as Element).closest('a.star') as SVGAElement);
    if (at < 0) return;
    const n = links.length;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at - 1 + n) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    rove(next);
    links[next].focus();
    const s = byHeat[next];
    const half = CENTER / view.z;
    if (Math.abs(s.x - view.cx) > half * 0.9 || Math.abs(s.y - view.cy) > half * 0.9) go({ z: view.z, cx: s.x, cy: s.y });
  });

  // ---------- 头像 ----------
  const slides = [...root.querySelectorAll<HTMLElement>('[data-avatar-slide]')];
  const steps = [...root.querySelectorAll<HTMLButtonElement>('[data-avatar-step]')];
  let shown = 0;
  const renderAvatar = () => {
    slides.forEach((s, i) => (s.hidden = i !== shown));
    for (const b of steps) {
      const next = shown + Number(b.dataset.avatarStep);
      b.disabled = next < 0 || next >= slides.length;
    }
  };
  for (const b of steps)
    on(b, 'click', () => {
      shown = Math.min(slides.length - 1, Math.max(0, shown + Number(b.dataset.avatarStep)));
      renderAvatar();
    });
  renderAvatar();

  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    offs.forEach((off) => off());
    ro.disconnect();
    cancelAnimationFrame(anim);
    clearTimeout(settled);
  };
}

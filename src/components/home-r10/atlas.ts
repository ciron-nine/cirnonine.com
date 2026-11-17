/**
 * PROTOTYPE（首页第十轮）：视星等的星图和星表（Atlas.astro）。
 * - 按 data.ts 算出的星等、layout.ts 算出的位置画星图；按星等排出星表
 * - 缩放就是换口径：读数是极限星等 6 + 5·log10(z)；比极限暗的星变淡，名字按三级（6.0 / 7.5 / 9.0）显示
 * - 指一颗星或星表里的一行：两边一起亮（朱色），它的系列一起亮，下面读出星名、星等、日期
 * - 键盘：星图只占一个 Tab 位置，方向键从亮到暗走
 * - 打开时星按星等出来（减少动态效果时直接全部出现）
 */
import { CENTER, RADIUS, SIZE } from '../../lib/star-chart-frame';
import { dateLabel, limitingMagnitude, loadEntries, magLabel, sampleMode, type Entry } from './data';
import { layout, LEVELS, type Star } from './layout';

const SVG = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const LABEL: Record<string, string> = { games: '游戏', 'visual-novels': '视觉小说', anime: '动画', songs: '音乐' };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}
const f1 = (n: number) => n.toFixed(1);

export function mountAtlas(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-atlas]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-sky]')!;
  const list = root.querySelector<HTMLOListElement>('[data-list]')!;
  const read = root.querySelector<HTMLElement>('[data-read]')!;
  const lmOut = root.querySelector<HTMLOutputElement>('[data-lm]')!;
  const still = reduced.matches;
  const offs: (() => void)[] = [];
  const on = (target: EventTarget, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    offs.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  const entries = loadEntries();
  const { stars, lines, boundaries, regions } = layout(entries);
  const byMag = [...stars].sort((a, b) => a.e.mag - b.e.mag);

  // ---------- 画星图 ----------
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'atlas-disc' }, defs);
  el('circle', { cx: CENTER, cy: CENTER, r: RADIUS }, clip);
  const sky = el('g', { 'clip-path': 'url(#atlas-disc)' }, svg);
  const grid = el('g', { class: 'grid' }, sky);
  for (let i = 1; i <= 8; i++) el('circle', { cx: CENTER, cy: CENTER, r: i * 60 }, grid);
  for (let h = 0; h < 24; h++) {
    const a = (h * 15 * Math.PI) / 180;
    el('line', { x1: CENTER + Math.cos(a) * 60, y1: CENTER + Math.sin(a) * 60, x2: CENTER + Math.cos(a) * RADIUS, y2: CENTER + Math.sin(a) * RADIUS }, grid);
  }
  const bounds = el('g', { class: 'bounds' }, sky);
  for (const d of boundaries) el('path', { d }, bounds);
  for (const r of regions) {
    const t = el('text', { x: f1(r.x), y: f1(r.y), 'text-anchor': 'middle', class: 'region', role: 'button', tabindex: 0, 'data-zoom-to': `${f1(r.fx)},${f1(r.fy)}`, 'aria-label': `放大到${LABEL[r.cat]}` }, sky);
    t.textContent = LABEL[r.cat];
  }
  const lineG = el('g', { class: 'lines' }, sky);
  const lineEls = lines.map(([a, b]) => {
    const l = el('line', { x1: f1(a.x), y1: f1(a.y), x2: f1(b.x), y2: f1(b.y), 'data-series': a.e.series ?? '' }, lineG);
    l.style.setProperty('--at', `${(0.4 + Math.max(a.e.mag, b.e.mag) * 0.42).toFixed(2)}s`);
    return l;
  });
  const starG = el('g', {}, sky);
  const starEls = new Map<Star, SVGAElement>();
  for (const s of byMag) {
    const a = el('a', { href: s.e.href, class: 'star', 'aria-label': `${s.e.title}，${magLabel(s.e.mag)} 等`, 'data-key': s.e.key, 'data-series': s.e.series ?? '' }, starG);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: f1(s.r + 6), class: 'hit' }, a);
    el('circle', { cx: f1(s.x), cy: f1(s.y), r: s.r.toFixed(2), class: 'dot' }, a);
    for (const level of LEVELS) {
      const l = s.labels[level];
      if (!l) continue;
      const t = el('text', { x: f1(l.x), y: f1(l.y), 'text-anchor': l.anchor, class: `l${level}`, 'aria-hidden': 'true' }, a);
      if (s.e.lang) t.setAttribute('lang', s.e.lang);
      t.textContent = s.e.title;
    }
    if (s.e.mag > 5) a.classList.add('dimmer');
    // 天黑下来：一等星大约 0.8 秒出来，六等星 3 秒上下
    a.style.setProperty('--at', `${(0.4 + s.e.mag * 0.42).toFixed(2)}s`);
    starEls.set(s, a);
  }
  el('circle', { cx: CENTER, cy: CENTER, r: RADIUS, class: 'rim' }, svg);
  const hours = el('g', { class: 'hours', 'aria-hidden': 'true' }, svg);
  for (let h = 0; h < 24; h += 2) {
    const a = (h * 15 * Math.PI) / 180;
    const t = el('text', { x: f1(CENTER + Math.cos(a) * 493), y: f1(CENTER + Math.sin(a) * 493 + 3.5), 'text-anchor': 'middle' }, hours);
    t.textContent = `${h}h`;
  }

  // ---------- 星表：按星等从亮到暗 ----------
  list.replaceChildren();
  let lastWhole = 0;
  for (const s of byMag) {
    const li = document.createElement('li');
    li.dataset.key = s.e.key;
    const whole = Math.floor(s.e.mag);
    if (whole !== lastWhole && lastWhole !== 0) li.classList.add('first');
    lastWhole = whole;
    li.innerHTML = '<span class="bayer"></span><a></a><span class="mag"></span><span class="cat"></span>';
    li.querySelector('.bayer')!.textContent = s.e.designation;
    const a = li.querySelector('a')!;
    a.href = s.e.href;
    a.textContent = s.e.title;
    if (s.e.lang) a.lang = s.e.lang;
    li.querySelector('.mag')!.textContent = magLabel(s.e.mag);
    li.querySelector('.cat')!.textContent = `${s.e.categoryLabel}　${dateLabel(s.e.date)}`;
    list.append(li);
  }

  // ---------- 打开时 ----------
  if (!still) {
    svg.dataset.dusk = '';
    requestAnimationFrame(() => requestAnimationFrame(() => delete svg.dataset.dusk));
  }
  const settled = window.setTimeout(() => {
    for (const a of starEls.values()) a.style.removeProperty('--at');
    for (const l of lineEls) l.style.removeProperty('--at');
  }, still ? 0 : 4500);

  // ---------- 缩放：换口径 ----------
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
    const lm = limitingMagnitude(v.z);
    lmOut.value = lm.toFixed(1);
    for (const [s, a] of starEls) a.classList.toggle('below', s.e.mag > lm);
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
  // 口径一档放大一倍：极限星等 +1.5
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

  // ---------- 点亮：星图和星表互相亮，系列一起亮，下面读出来 ----------
  const lit: Element[] = [];
  const idle = () => {
    const n = (m: number) => entries.filter((e) => e.mag <= m).length;
    read.textContent = `${entries.length} 颗星，肉眼看得见 ${n(6)} 颗`;
  };
  const clear = () => {
    for (const x of lit) x.classList.remove('lit');
    lit.length = 0;
    idle();
  };
  const light = (key: string | undefined) => {
    clear();
    const s = stars.find((t) => t.e.key === key);
    if (!s) return;
    const add = (els: Iterable<Element>) => {
      for (const x of els) {
        x.classList.add('lit');
        lit.push(x);
      }
    };
    add(root.querySelectorAll(`[data-key="${CSS.escape(s.e.key)}"]`));
    if (s.e.series) add(svg.querySelectorAll(`line[data-series="${CSS.escape(s.e.series)}"]`));
    read.replaceChildren();
    const b = document.createElement('b');
    b.textContent = s.e.title;
    if (s.e.lang) b.lang = s.e.lang;
    read.append(b, `${s.e.designation} ${s.e.categoryLabel}　${magLabel(s.e.mag)} 等　${dateLabel(s.e.date)}`);
  };
  const keyOf = (t: EventTarget | null) => (t as Element | null)?.closest?.<HTMLElement | SVGElement>('[data-key]')?.dataset.key;
  on(svg, 'pointerover', (e: PointerEvent) => {
    const k = keyOf(e.target);
    if (k) light(k);
  });
  on(svg, 'pointerout', (e: PointerEvent) => {
    if (keyOf(e.target)) clear();
  });
  on(svg, 'focusin', (e: FocusEvent) => light(keyOf(e.target)));
  on(svg, 'focusout', clear);
  on(list, 'pointerover', (e: PointerEvent) => light(keyOf(e.target)));
  on(list, 'pointerleave', clear);
  on(list, 'focusin', (e: FocusEvent) => light(keyOf(e.target)));
  on(list, 'focusout', clear);
  idle();

  // ---------- 键盘：一个 Tab 位置，方向键从亮到暗 ----------
  const links = byMag.map((s) => starEls.get(s)!);
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
    const s = byMag[next];
    const half = CENTER / view.z;
    if (Math.abs(s.x - view.cx) > half * 0.9 || Math.abs(s.y - view.cy) > half * 0.9) go({ z: view.z, cx: s.x, cy: s.y });
  });

  // ---------- 头像：一次一张，往回翻 ----------
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
    cancelAnimationFrame(anim);
    clearTimeout(settled);
  };
}

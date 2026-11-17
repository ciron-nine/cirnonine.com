/**
 * PROTOTYPE（首页第十一轮）：物镜棱镜底片（Spectra.astro）。
 * - 画布（emulsion）：天河那样密的暗星、中心那颗「我」的光晕、每条记录一小条光谱
 * - SVG（marks）：各型的分界椭圆（点线，往外跑出屏幕）、四个方向、沿着椭圆写的类别名、底片边上的毫米刻度、
 *   每一条光谱的点击区和旁边写着的光谱型；同一系列用虚线连起来
 * - 指着一条（或星表里的一行）：中心换成它的光谱型和名字，底边换成它的光谱；没指着时是所有记录加在一起
 * - 键盘：底片只占一个 Tab 位置，方向键从热到冷走
 * 位置沿用 layout.ts 的极坐标（1000×1000、外缘半径 470），在这里压成铺满底片的椭圆。
 */
import { dateLabel, kelvin, loadEntries, sampleMode } from './data';
import { layout } from './layout';
import { blackbodyHex, classify, drawSpectrum, LINES, mixedTemperature, spectrumRow, VISIBLE } from './spectrum';

const SVG = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const LABEL: Record<string, string> = { games: '游戏', 'visual-novels': '视觉小说', anime: '动画', songs: '音乐' };
/** 哈佛的底片是 8×10 英寸：边上的刻度按 254 × 203 毫米标 */
const PLATE_MM: [number, number] = [254, 203];

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}
const f1 = (n: number) => n.toFixed(1);

function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function mountSpectra(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-sp]')!;
  const plate = root.querySelector<HTMLElement>('[data-plate]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-emulsion]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-marks]')!;
  const typeEl = root.querySelector<HTMLElement>('[data-type]')!;
  const nameEl = root.querySelector<HTMLElement>('[data-name]')!;
  const metaEl = root.querySelector<HTMLElement>('[data-meta]')!;
  const strip = root.querySelector<HTMLCanvasElement>('[data-strip]')!;
  const lineMarks = root.querySelector<HTMLElement>('[data-lines]')!;
  const plateNo = root.querySelector<HTMLElement>('[data-plate-no]')!;
  const still = reduced.matches;
  const offs: (() => void)[] = [];
  const on = (target: EventTarget, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    offs.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  const entries = loadEntries();
  const { stars, lines, rings } = layout(entries);
  const byHeat = [...stars].sort((a, b) => b.e.T - a.e.T);
  const allT = entries.map((e) => e.T);
  const mixT = mixedTemperature(allT);
  const mix = classify(mixT);
  const mixColor = blackbodyHex(mixT);
  const today = new Date();
  plateNo.textContent = `物镜棱镜底片　№ ${String(entries.length).padStart(3, '0')}　${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;

  // ---------- 几何：1000×1000 的极坐标压成铺满底片的椭圆 ----------
  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let RX = 0;
  let RY = 0;
  const P = (x: number, y: number): [number, number] => [cx + ((x - 500) / 470) * RX, cy + ((y - 500) / 470) * RY];
  const onEllipse = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * (r / 470) * RX, cy + Math.sin(a) * (r / 470) * RY];
  };
  const recEls = new Map<string, SVGAElement>();
  let streakLen = 64;
  let roved = 0;
  const rove = (i: number) => {
    roved = i;
    byHeat.forEach((s, j) => recEls.get(s.e.key)?.setAttribute('tabindex', i === j ? '0' : '-1'));
  };

  const draw = () => {
    W = plate.clientWidth;
    H = plate.clientHeight;
    const mobile = W < 640;
    const top = 28;
    const bottom = mobile ? 92 : 104;
    RY = (H - top - bottom) / 2;
    RX = W / 2 - (mobile ? 18 : 64);
    cx = W / 2;
    cy = top + RY;
    streakLen = mobile ? 34 : 60;
    plate.style.setProperty('--cx', `${cx}px`);
    plate.style.setProperty('--cy', `${cy}px`);

    // ---------- 画布 ----------
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const rand = rng(9);
    const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2;
    // 天河：一条斜着穿过底片的密带
    const bandAngle = -0.42;
    const ux = Math.cos(bandAngle);
    const uy = Math.sin(bandAngle);
    const n = Math.round((W * H) / 150);
    for (let i = 0; i < n; i++) {
      const t = (rand() - 0.5) * Math.hypot(W, H);
      const off = gauss() * H * (0.12 + 0.08 * Math.sin(t / 140));
      const x = cx + ux * t - uy * off;
      const y = cy + uy * t + ux * off;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const a = 0.16 + Math.pow(rand(), 3) * 0.7;
      ctx.fillStyle = `rgba(214,222,240,${a.toFixed(3)})`;
      const s = 0.5 + Math.pow(rand(), 4) * 1.3;
      ctx.fillRect(x, y, s, s);
    }
    // 满天散着的暗星
    for (let i = 0; i < (W * H) / 1400; i++) {
      ctx.fillStyle = `rgba(214,222,240,${(0.08 + rand() * 0.35).toFixed(3)})`;
      const s = 0.5 + Math.pow(rand(), 5) * 1.5;
      ctx.fillRect(rand() * W, rand() * H, s, s);
    }
    // 中心那颗「我」：所有光加在一起的颜色，一大团光晕
    const coreRX = (150 / 470) * RX * 1.5;
    const coreRY = (150 / 470) * RY * 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, coreRY / coreRX);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRX);
    g.addColorStop(0, `${mixColor}bb`);
    g.addColorStop(0.2, `${mixColor}50`);
    g.addColorStop(0.55, `${mixColor}12`);
    g.addColorStop(1, `${mixColor}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, coreRX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 每条记录：一小条光谱。先画在一张透明的画布上，整张糊一次叠上去当光晕，再把清楚的叠上去
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext('2d')!;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = streakLen;
    for (const s of stars) {
      const [x, y] = P(s.x, s.y);
      // 底片上照普朗克定律原样：热星的一条偏蓝，冷星的一条偏红
      const row = spectrumRow(s.e.T, Math.round(L * 2), 1.1);
      row.forEach(([r, gg, b], i) => {
        octx.fillStyle = `rgb(${r},${gg},${b})`;
        octx.fillRect(x - L / 2 + i / 2, y - 2.5, 0.6, 5);
      });
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${5 * dpr}px)`;
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0);
    ctx.restore();

    // ---------- SVG ----------
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const defs = el('defs', {}, svg);
    // 各型的分界：点线椭圆；外面再加几圈跑出屏幕
    for (const ring of rings) el('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1((ring.r / 470) * RX), ry: f1((ring.r / 470) * RY), class: 'ring' }, svg);
    el('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1((150 / 470) * RX), ry: f1((150 / 470) * RY), class: 'ring' }, svg);
    for (const k of [1.0, 1.14, 1.3, 1.5, 1.74]) el('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(k * RX), ry: f1(k * RY), class: 'ring outer' }, svg);
    // 四个方向：两条轴，从中心那一圈往外画到底片边
    for (const deg of [0, 90, 180, 270]) {
      const [x1, y1] = onEllipse(150, deg);
      const [x2, y2] = onEllipse(470 * 2, deg);
      el('line', { x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2), class: 'axis' }, svg);
    }
    // 各型的字母：写在左右两条轴上，每一型那一圈的正中
    const edges = [150, ...rings.map((r) => r.r), 470];
    'OBAFGKM'.split('').forEach((cls, i) => {
      const r = (edges[i] + edges[i + 1]) / 2;
      for (const deg of [0, 180]) {
        const [x, y] = onEllipse(r, deg);
        const t = el('text', { x: f1(x), y: f1(y - 9), class: 'ring-label' }, svg);
        t.textContent = cls;
      }
    });
    // 类别名：沿着最外一圈椭圆写，下半边反过来走，字是正的
    ['games', 'visual-novels', 'anime', 'songs'].forEach((cat, k) => {
      const a0 = k * 90 + 25;
      const a1 = k * 90 + 65;
      const lower = Math.sin(((a0 + a1) / 2) * (Math.PI / 180)) > 0;
      const r = 470 * 1.07;
      const [x0, y0] = onEllipse(r, lower ? a1 : a0);
      const [x1, y1] = onEllipse(r, lower ? a0 : a1);
      const id = `sp-arc-${k}`;
      el('path', { id, d: `M${f1(x0)} ${f1(y0)} A${f1((r / 470) * RX)} ${f1((r / 470) * RY)} 0 0 ${lower ? 0 : 1} ${f1(x1)} ${f1(y1)}`, fill: 'none' }, defs);
      const t = el('text', { class: 'region', dy: lower ? 14 : -6 }, svg);
      const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, t);
      tp.textContent = LABEL[cat];
    });
    // 底片边上的毫米刻度（上、左、右）
    const scale = el('g', { 'aria-hidden': 'true' }, svg);
    let d = '';
    for (let mm = 0; mm <= PLATE_MM[0]; mm += 2) {
      const x = (mm / PLATE_MM[0]) * W;
      const len = mm % 10 === 0 ? 9 : 4;
      d += `M${f1(x)} 0V${len}`;
      if (mm % 50 === 0 && mm > 0 && mm < PLATE_MM[0]) {
        const t = el('text', { x: f1(x + 3), y: 18, class: 'scale-num' }, scale);
        t.textContent = String(mm);
      }
    }
    for (let mm = 0; mm <= PLATE_MM[1]; mm += 2) {
      const y = (mm / PLATE_MM[1]) * H;
      const len = mm % 10 === 0 ? 9 : 4;
      d += `M0 ${f1(y)}H${len}M${W} ${f1(y)}H${W - len}`;
    }
    el('path', { d, class: 'scale' }, scale);
    // 同一系列：虚线连起来
    const seriesG = el('g', {}, svg);
    for (const [a, b] of lines) {
      const [x1, y1] = P(a.x, a.y);
      const [x2, y2] = P(b.x, b.y);
      el('line', { x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2), class: 'series' }, seriesG);
    }
    // 每一条光谱：点击区、外框、旁边的光谱型、指着时出来的名字
    const recG = el('g', {}, svg);
    recEls.clear();
    for (const s of byHeat) {
      const [x, y] = P(s.x, s.y);
      const L = streakLen;
      const a = el('a', { href: s.e.href, class: 'rec', 'data-key': s.e.key, 'aria-label': `${s.e.title}，${s.e.type} 型` }, recG);
      a.style.setProperty('--star', s.e.star);
      el('rect', { x: f1(x - L / 2 - 6), y: f1(y - 9), width: f1(L + 30), height: 18, class: 'hit' }, a);
      el('rect', { x: f1(x - L / 2 - 4), y: f1(y - 6), width: f1(L + 8), height: 12, class: 'frame' }, a);
      const tag = el('text', { x: f1(x + L / 2 + 5), y: f1(y + 3.5), class: 'tag' }, a);
      tag.textContent = s.e.type;
      const right = x < W - 260;
      const title = el('text', { x: f1(right ? x - L / 2 : x + L / 2), y: f1(y - 12), 'text-anchor': right ? 'start' : 'end', class: 'title' }, a);
      title.textContent = s.e.title;
      if (s.e.lang) title.setAttribute('lang', s.e.lang);
      recEls.set(s.e.key, a);
    }
    rove(roved);
  };

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
      li.querySelector('.type')!.textContent = s.e.type;
      const a = li.querySelector('a')!;
      a.href = s.e.href;
      a.textContent = s.e.title;
      if (s.e.lang) a.lang = s.e.lang;
      li.querySelector('.cat')!.textContent = s.e.categoryLabel;
      ol.append(li);
    }
  }

  // ---------- 放大镜下的光谱 ----------
  const showSpectrum = (T: number | number[]) => {
    const w = Math.max(Math.round(strip.clientWidth * Math.min(devicePixelRatio, 2)), 200);
    if (strip.width !== w) strip.width = w;
    drawSpectrum(strip, T);
    const { cls } = classify(Array.isArray(T) ? mixedTemperature(T) : T);
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
    root.style.setProperty('--cur', mixColor);
    typeEl.textContent = mix.label;
    nameEl.textContent = 'cirnonine';
    nameEl.removeAttribute('lang');
    metaEl.textContent = `${kelvin(mixT)}　${entries.length} 部作品的光，一样亮，加在一起`;
    showSpectrum(allT);
  };
  const lit: Element[] = [];
  const clear = () => {
    for (const x of lit) x.classList.remove('lit');
    lit.length = 0;
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
    root.style.setProperty('--cur', s.e.star);
    typeEl.textContent = s.e.type;
    nameEl.textContent = s.e.title;
    if (s.e.lang) nameEl.lang = s.e.lang;
    else nameEl.removeAttribute('lang');
    const cover = document.createElement('span');
    cover.className = 'sw';
    cover.style.background = s.e.cover;
    const star = document.createElement('span');
    star.className = 'sw';
    star.style.background = s.e.star;
    metaEl.replaceChildren(kelvin(s.e.T), cover, '封面', star, `星色　${s.e.categoryLabel}　${dateLabel(s.e.date)}`);
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

  // ---------- 键盘：一个 Tab 位置，方向键从热到冷 ----------
  on(svg, 'keydown', (e: KeyboardEvent) => {
    const key = keyOf(e.target);
    const at = byHeat.findIndex((s) => s.e.key === key);
    if (at < 0) return;
    const n = byHeat.length;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at - 1 + n) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    rove(next);
    recEls.get(byHeat[next].e.key)?.focus();
  });

  // ---------- 画出来；打开时底片「显影」 ----------
  draw();
  idle();
  if (!still) {
    canvas.animate([{ opacity: 0, filter: 'brightness(3)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 1600, easing: 'ease-out' });
  }
  let timer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      draw();
      if (lit.length) light(keyOf(lit[0]));
      else showSpectrum(allT);
    }, 120);
  });
  ro.observe(plate);

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
    clearTimeout(timer);
  };
}

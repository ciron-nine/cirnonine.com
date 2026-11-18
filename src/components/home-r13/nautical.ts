/**
 * PROTOTYPE（首页第十三轮）：夜航海图（Nautical.astro）。
 * - 画布：按水深分层的底色（越浅越亮，海图的老习惯）和陆地
 * - SVG：等深线、海岸线、零星的水深数字、罗经花、导标线、每一盏灯（品红光芒符号 + 会闪的光 + 灯质）
 * - 每一帧：每盏灯按自己的灯质算这一刻亮不亮（lights.ts，用真实的时间，所以每次来都在同一个节拍上）；
 *   主灯的光束绕罗经花转一圈 24 秒，扫到哪盏灯，那盏灯旁边浮出名字，几秒后淡掉
 * - 指着一盏灯（或灯标表里的一行）：读出它的名字、灯质、类别；点它打开
 * - 减少动态效果：灯常亮，不转光束
 */
import { coastPoints, contour, DEPTHS, depthAt, depthLevel, makeSea, rng } from './chart';
import { brightness, characteristic, COLOR_HEX, COLOR_NAME, hash, KIND_NAME, type Characteristic } from './lights';

interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: string;
  categoryLabel: string;
  series?: string;
  date: { precision: string; year?: number; month?: number; day?: number };
  coverColor?: string;
}
interface Light {
  r: Rec;
  c: Characteristic;
  x: number;
  y: number;
  el?: SVGGElement;
  glow?: SVGCircleElement;
  name?: SVGTextElement;
  seen: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const BEAM_PERIOD = 24;
const f1 = (n: number) => n.toFixed(1);
const dateLabel = (d: Rec['date']) =>
  d.precision === 'day' ? `${d.year}年${d.month}月${d.day}日` : d.precision === 'month' ? `${d.year}年${d.month}月` : d.precision === 'year' ? `${d.year}年` : '很久以前';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}

/** 示意的封面颜色（封面现在都是占位图） */
function sampleCover(key: string) {
  const h = hash(key + 'h') * 360;
  const s = 0.15 + hash(key + 's') * 0.75;
  const l = 0.35 + hash(key + 'l') * 0.4;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function mountNautical(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-nt]')!;
  const chart = root.querySelector<HTMLElement>('[data-chart]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-sea]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-marks]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const charEl = root.querySelector<HTMLElement>('[data-char]')!;
  const subEl = root.querySelector<HTMLElement>('[data-sub]')!;
  const still = reduced.matches;
  const sample = new URL(location.href).searchParams.get('sample') === '1';
  const records: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  root.querySelector<HTMLElement>('[data-count]')!.textContent = `灯 ${records.length} 盏　深度单位：米`;
  if (sample) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  const lights: Light[] = records.map((r) => ({
    r,
    c: characteristic(r.category, r.title, sample ? sampleCover(r.key) : r.coverColor, r.key),
    x: 0,
    y: 0,
    seen: -1e9,
  }));

  let rose = { x: 0, y: 0, r: 0 };
  let hovered: Light | undefined;
  let beamG: SVGGElement | undefined;

  const draw = () => {
    const W = chart.clientWidth;
    const H = chart.clientHeight;
    const mobile = W < 700;
    rose = { x: W * (mobile ? 0.5 : 0.42), y: H * 0.52, r: Math.min(W, H) * (mobile ? 0.34 : 0.3) };
    const sea = makeSea(W, H, rose);

    // ---------- 底色：按水深分层 ----------
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d')!;
    const small = document.createElement('canvas');
    small.width = sea.cols;
    small.height = sea.rows;
    const sctx = small.getContext('2d')!;
    const img = sctx.createImageData(sea.cols, sea.rows);
    const band = (m: number): [number, number, number] =>
      m <= 0 ? [10, 13, 18] : m < 5 ? [26, 46, 70] : m < 10 ? [20, 38, 60] : m < 20 ? [15, 30, 50] : m < 50 ? [11, 23, 40] : m < 100 ? [8, 18, 32] : [6, 13, 24];
    for (let i = 0; i < sea.cols * sea.rows; i++) {
      const [r, g, b] = band(-sea.h[i] * 120);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, sea.cols * sea.cell * dpr, sea.rows * sea.cell * dpr);
    // 陆地上细细的斜排线，像海图上的陆地
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = 'rgba(160,180,200,0.07)';
    ctx.lineWidth = 0.6;
    for (let j = 0; j < sea.rows; j++)
      for (let i = 0; i < sea.cols; i++) {
        if (sea.h[j * sea.cols + i] <= 0.02 || (i + j) % 2) continue;
        const x = i * sea.cell;
        const y = j * sea.cell;
        ctx.beginPath();
        ctx.moveTo(x, y + sea.cell);
        ctx.lineTo(x + sea.cell, y);
        ctx.stroke();
      }
    ctx.restore();

    // ---------- SVG ----------
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const defs = el('defs', {}, svg);
    for (const [k, hex] of Object.entries(COLOR_HEX)) {
      const g = el('radialGradient', { id: `nt-glow-${k}` }, defs);
      el('stop', { offset: '0', 'stop-color': hex, 'stop-opacity': 1 }, g);
      el('stop', { offset: '0.18', 'stop-color': hex, 'stop-opacity': 0.55 }, g);
      el('stop', { offset: '1', 'stop-color': hex, 'stop-opacity': 0 }, g);
    }
    const beamGrad = el('radialGradient', { id: 'nt-beam', cx: 0, cy: 0, r: 1, gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(${rose.x} ${rose.y}) scale(${Math.hypot(W, H)})` }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff3d6', 'stop-opacity': 0.32 }, beamGrad);
    el('stop', { offset: '0.6', 'stop-color': '#fff3d6', 'stop-opacity': 0.06 }, beamGrad);
    el('stop', { offset: '1', 'stop-color': '#fff3d6', 'stop-opacity': 0 }, beamGrad);

    // 等深线和海岸线
    for (const m of DEPTHS) el('path', { d: contour(sea, depthLevel(m)), class: `contour${m <= 10 ? ' shallow' : ''}` }, svg);
    el('path', { d: contour(sea, 0), class: 'coast' }, svg);
    // 零星的水深数字：海图上那种斜体小字
    const rand = rng(3);
    for (let k = 0; k < (W * H) / 9000; k++) {
      const x = 20 + rand() * (W - 40);
      const y = 20 + rand() * (H - 40);
      if (Math.hypot(x - rose.x, y - rose.y) < rose.r * 1.08) continue;
      const d = depthAt(sea, x, y);
      if (d <= 0) continue;
      const t = el('text', { x: f1(x), y: f1(y), class: 'sounding' }, svg);
      t.textContent = String(d);
    }

    // ---------- 罗经花 ----------
    const R = rose.r;
    const pt = (deg: number, r: number): [number, number] => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [rose.x + Math.cos(a) * r, rose.y + Math.sin(a) * r];
    };
    el('circle', { cx: rose.x, cy: rose.y, r: R, class: 'rose-ring' }, svg);
    el('circle', { cx: rose.x, cy: rose.y, r: R * 0.93, class: 'rose-ring' }, svg);
    let ticks = '';
    for (let deg = 0; deg < 360; deg++) {
      const len = deg % 10 === 0 ? 0.05 : deg % 5 === 0 ? 0.035 : 0.02;
      const [x1, y1] = pt(deg, R * 0.93);
      const [x2, y2] = pt(deg, R * (0.93 + len));
      ticks += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
    }
    el('path', { d: ticks, class: 'rose-tick' }, svg);
    for (let deg = 0; deg < 360; deg += 30) {
      const [x, y] = pt(deg, R * 1.06);
      const t = el('text', { x: f1(x), y: f1(y), class: 'rose-num' }, svg);
      t.textContent = String(deg).padStart(3, '0');
    }
    // 里面一圈是磁方位，偏 4° 西
    const VAR = -4;
    el('circle', { cx: rose.x, cy: rose.y, r: R * 0.7, class: 'rose-ring' }, svg);
    let mticks = '';
    for (let deg = 0; deg < 360; deg += 5) {
      const [x1, y1] = pt(deg + VAR, R * 0.7);
      const [x2, y2] = pt(deg + VAR, R * (deg % 30 === 0 ? 0.66 : 0.68));
      mticks += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
    }
    el('path', { d: mticks, class: 'rose-tick' }, svg);
    const [mx, my] = pt(180 + VAR, R * 0.58);
    const mag = el('text', { x: f1(mx), y: f1(my), class: 'rose-mag' }, svg);
    mag.textContent = '磁差 4°W';
    // 三十二个方位的细线，八个主方位的尖
    let lines = '';
    for (let k = 0; k < 32; k++) {
      const [x, y] = pt(k * 11.25, R * 0.66);
      lines += `M${f1(rose.x)} ${f1(rose.y)}L${f1(x)} ${f1(y)}`;
    }
    el('path', { d: lines, class: 'rose-line' }, svg);
    for (let k = 0; k < 8; k++) {
      const deg = k * 45;
      const len = k % 2 === 0 ? 0.62 : 0.4;
      const w = k % 2 === 0 ? 0.07 : 0.05;
      const [tx, ty] = pt(deg, R * len);
      const [lx, ly] = pt(deg - 90, R * w);
      const [rx, ry] = pt(deg + 90, R * w);
      el('path', { d: `M${f1(rose.x)} ${f1(rose.y)}L${f1(lx)} ${f1(ly)}L${f1(tx)} ${f1(ty)}Z`, class: 'rose-point' }, svg);
      el('path', { d: `M${f1(rose.x)} ${f1(rose.y)}L${f1(rx)} ${f1(ry)}L${f1(tx)} ${f1(ty)}Z`, class: 'rose-point half' }, svg);
    }

    // ---------- 主灯的光束（在灯下面） ----------
    beamG = el('g', { class: 'beam' }, svg);
    const L = Math.hypot(W, H);
    for (const off of [0, 180]) {
      const a0 = ((off - 4 - 90) * Math.PI) / 180;
      const a1 = ((off + 4 - 90) * Math.PI) / 180;
      el('path', { d: `M${f1(rose.x)} ${f1(rose.y)}L${f1(rose.x + Math.cos(a0) * L)} ${f1(rose.y + Math.sin(a0) * L)}L${f1(rose.x + Math.cos(a1) * L)} ${f1(rose.y + Math.sin(a1) * L)}Z`, fill: 'url(#nt-beam)' }, beamG);
    }
    el('circle', { cx: rose.x, cy: rose.y, r: 4, fill: '#fff3d6' }, svg);

    // ---------- 灯放在哪 ----------
    const coast = coastPoints(sea, W, H, 40);
    const taken: [number, number][] = [];
    const free = (x: number, y: number, d: number) => taken.every(([a, b]) => Math.hypot(a - x, b - y) > d) && Math.hypot(x - rose.x, y - rose.y) > R * 1.15;
    const pickSpot = (k: string): [number, number] => {
      const start = Math.floor(hash(k) * coast.length);
      for (const d of [mobile ? 40 : 72, mobile ? 30 : 56, mobile ? 22 : 40, 22]) {
        for (let n = 0; n < coast.length; n++) {
          const [x, y] = coast[(start + n * 7) % coast.length];
          if (free(x, y, d)) return [x, y];
        }
      }
      // 海岸放满了：放在浅滩上，当作浮标
      for (let n = 0; n < 400; n++) {
        const x = 40 + hash(k + n) * (W - 80);
        const y = 40 + hash(k + n + 'y') * (H - 80);
        if (free(x, y, 22) && depthAt(sea, x, y) > 0 && depthAt(sea, x, y) < 40) return [x, y];
      }
      return [40 + hash(k) * (W - 80), 40 + hash(k + 'y') * (H - 80)];
    };
    const bySeries = new Map<string, Light[]>();
    for (const l of lights) if (l.r.series) bySeries.set(l.r.series, [...(bySeries.get(l.r.series) ?? []), l]);
    const leads: { x1: number; y1: number; x2: number; y2: number; deg: number }[] = [];
    // 一组导标灯：前灯在岸上，后面几盏沿着同一条线往陆地里排；海上画出这条线
    for (const [series, group] of bySeries) {
      const [x, y] = pickSpot(series);
      // 往高处（陆地里）走的方向
      const gx = sea.at(x + 6, y) - sea.at(x - 6, y);
      const gy = sea.at(x, y + 6) - sea.at(x, y - 6);
      const gl = Math.hypot(gx, gy) || 1;
      const ux = gx / gl;
      const uy = gy / gl;
      group.forEach((l, i) => {
        l.x = x + ux * i * 18;
        l.y = y + uy * i * 18;
        taken.push([l.x, l.y]);
      });
      const len = Math.min(W, H) * 0.22;
      const deg = (((Math.atan2(uy, ux) * 180) / Math.PI + 90 + 360) % 360);
      leads.push({ x1: x, y1: y, x2: x - ux * len, y2: y - uy * len, deg: Math.round(deg) });
    }
    for (const l of lights) {
      if (l.r.series) continue;
      [l.x, l.y] = pickSpot(l.r.key);
      taken.push([l.x, l.y]);
    }
    for (const ld of leads) {
      el('line', { x1: f1(ld.x1), y1: f1(ld.y1), x2: f1(ld.x2), y2: f1(ld.y2), class: 'lead' }, svg);
      const t = el('text', { x: f1(ld.x2 + 4), y: f1(ld.y2 - 4), class: 'lead-label' }, svg);
      t.textContent = `导标 ${String(ld.deg).padStart(3, '0')}°`;
    }

    // ---------- 灯 ----------
    const lightG = el('g', {}, svg);
    for (const l of lights) {
      const g = el('g', { class: 'light', 'data-key': l.r.key, tabindex: -1, role: 'link', 'aria-label': `${l.r.title}，${l.c.label}` }, lightG);
      el('circle', { cx: f1(l.x), cy: f1(l.y), r: 14, class: 'hit' }, g);
      l.glow = el('circle', { cx: f1(l.x), cy: f1(l.y), r: 16, fill: `url(#nt-glow-${l.c.color})`, opacity: 0 }, g);
      // 海图上标灯的品红光芒：一片泪滴，从灯点斜着伸出去
      const a = (hash(l.r.key + 'flare') * 0.6 + 0.2) * Math.PI;
      const fx = l.x + Math.cos(a) * 14;
      const fy = l.y - Math.sin(a) * 14;
      el('path', { d: `M${f1(l.x)} ${f1(l.y)}Q${f1(l.x + Math.cos(a + 0.5) * 9)} ${f1(l.y - Math.sin(a + 0.5) * 9)} ${f1(fx)} ${f1(fy)}Q${f1(l.x + Math.cos(a - 0.5) * 9)} ${f1(l.y - Math.sin(a - 0.5) * 9)} ${f1(l.x)} ${f1(l.y)}Z`, class: 'flare' }, g);
      el('circle', { cx: f1(l.x), cy: f1(l.y), r: 1.8, class: 'dot' }, g);
      el('circle', { cx: f1(l.x), cy: f1(l.y), r: 9, class: 'ring' }, g);
      const right = l.x < W - 160;
      const ch = el('text', { x: f1(l.x + (right ? 8 : -8)), y: f1(l.y + 13), 'text-anchor': right ? 'start' : 'end', class: 'char' }, g);
      ch.textContent = l.c.label;
      l.name = el('text', { x: f1(l.x + (right ? 8 : -8)), y: f1(l.y - 7), 'text-anchor': right ? 'start' : 'end', class: 'name', opacity: 0 }, g);
      l.name.textContent = l.r.title;
      if (l.r.lang) l.name.setAttribute('lang', l.r.lang);
      l.el = g;
    }
    rove(roved);
  };

  // ---------- 灯标表 ----------
  for (const section of root.querySelectorAll<HTMLElement>('.groups section')) {
    const ol = section.querySelector('ol')!;
    ol.replaceChildren();
    const mine = lights.filter((l) => l.r.category === section.dataset.cat).sort((a, b) => a.r.title.localeCompare(b.r.title));
    for (const l of mine) {
      const li = document.createElement('li');
      li.dataset.key = l.r.key;
      li.innerHTML = '<a></a><span class="lc"><b></b></span>';
      const a = li.querySelector('a')!;
      a.href = l.r.href;
      a.textContent = l.r.title;
      if (l.r.lang) a.lang = l.r.lang;
      const lc = li.querySelector<HTMLElement>('.lc')!;
      lc.style.setProperty('--c', COLOR_HEX[l.c.color]);
      lc.append(l.c.label);
      ol.append(li);
    }
  }

  // ---------- 读数 ----------
  const show = (l: Light | undefined) => {
    hovered = l;
    for (const x of lights) x.el?.classList.toggle('on', x === l);
    for (const li of root.querySelectorAll<HTMLElement>('.groups li')) li.classList.toggle('on', li.dataset.key === l?.r.key);
    if (!l) {
      titleEl.textContent = '';
      charEl.textContent = '';
      subEl.textContent = '';
      return;
    }
    titleEl.textContent = l.r.title;
    if (l.r.lang) titleEl.lang = l.r.lang;
    else titleEl.removeAttribute('lang');
    charEl.textContent = l.c.label;
    subEl.textContent = `${COLOR_NAME[l.c.color]}光　${KIND_NAME[l.c.kind]}　${l.r.categoryLabel}　${dateLabel(l.r.date)}`;
  };
  const lightOf = (t: EventTarget | null) => {
    const key = (t as Element | null)?.closest?.<SVGElement | HTMLElement>('[data-key]')?.dataset.key;
    return lights.find((l) => l.r.key === key);
  };
  const onOver = (e: PointerEvent) => show(lightOf(e.target));
  const onOut = (e: PointerEvent) => {
    if (!lightOf(e.relatedTarget)) show(undefined);
  };
  const onClick = (e: MouseEvent) => {
    const l = lightOf(e.target);
    if (l) location.href = l.r.href;
  };
  svg.addEventListener('pointerover', onOver);
  svg.addEventListener('pointerout', onOut);
  svg.addEventListener('click', onClick);
  const groups = root.querySelector<HTMLElement>('.groups')!;
  groups.addEventListener('pointerover', onOver);
  groups.addEventListener('pointerleave', () => show(undefined));

  // 键盘：一个 Tab 位置，方向键在灯之间走
  let roved = 0;
  function rove(i: number) {
    roved = i;
    lights.forEach((l, j) => l.el?.setAttribute('tabindex', j === i ? '0' : '-1'));
  }
  const onKey = (e: KeyboardEvent) => {
    const at = lights.findIndex((l) => l === lightOf(e.target));
    if (at < 0) return;
    const n = lights.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at - 1 + n) % n : -1;
    if (e.key === 'Enter') location.href = lights[at].r.href;
    if (next < 0) return;
    e.preventDefault();
    rove(next);
    lights[next].el?.focus();
    show(lights[next]);
  };
  svg.addEventListener('keydown', onKey);
  svg.addEventListener('focusin', (e) => show(lightOf(e.target)));

  // ---------- 每一帧 ----------
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = performance.timeOrigin / 1000 + performance.now() / 1000;
    const beamDeg = ((t % BEAM_PERIOD) / BEAM_PERIOD) * 360;
    beamG?.setAttribute('transform', `rotate(${beamDeg.toFixed(2)} ${rose.x.toFixed(1)} ${rose.y.toFixed(1)})`);
    for (const l of lights) {
      const phase = hash(l.r.key + 'phase') * l.c.period;
      const b = brightness(l.c, t + phase);
      l.glow?.setAttribute('opacity', b.toFixed(2));
      l.glow?.setAttribute('r', (10 + b * 10).toFixed(1));
      // 光束扫过：浮出名字
      const a = ((Math.atan2(l.y - rose.y, l.x - rose.x) * 180) / Math.PI + 90 + 360) % 360;
      // 光束是一对，相隔 180°：只看角度差模 180
      const diff = (((a - beamDeg) % 180) + 180) % 180;
      if (diff < 4 || diff > 176) l.seen = t;
      const fade = l === hovered ? 1 : Math.max(0, 1 - (t - l.seen) / 3.5);
      l.name?.setAttribute('opacity', fade.toFixed(2));
    }
  };

  draw();
  if (still) {
    for (const l of lights) {
      l.glow?.setAttribute('opacity', '0.8');
    }
  } else raf = requestAnimationFrame(frame);
  let timer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(draw, 150);
  });
  ro.observe(chart);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    ro.disconnect();
    svg.removeEventListener('pointerover', onOver);
    svg.removeEventListener('pointerout', onOut);
    svg.removeEventListener('click', onClick);
    svg.removeEventListener('keydown', onKey);
  };
}

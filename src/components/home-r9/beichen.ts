/**
 * PROTOTYPE（首页第九轮）：北辰的星图。坐标系：viewBox 1000×1000，圆心 (500,500) 是北极；
 * 去极度 p 映到半径 p / 145 × 400（外规就是半径 400 的那一圈）；赤经 α 顺时针排（面北仰望，东在右），
 * 整个天球按地方恒星时转：此刻在子午线上的赤经朝正上方。
 */
import { dateLabel, keyOrder, loadRecords, sampleMode, SVG, type Rec } from '../home-r7/r7-data';
import {
  CHIDAO,
  eclipticToEquatorial,
  galacticToEquatorial,
  jieqi,
  localSiderealDeg,
  MANSION_SPANS,
  mansionAt,
  NEI_GUI,
  shichen,
  sunLongitude,
  toDeg,
  WAI_GUI,
  XIANG,
  xiangSpan,
  ZHOUTIAN,
  type Xiang,
} from './sky';

const C = 500;
const R = 400; // 外规
const RIM = 436; // 刻度环外沿
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/** 五方五音：东角木、南徵火、西商金、北羽水——音乐属商，在西 */
const CAT_XIANG: Record<Rec['category'], Xiang> = { games: 'east', 'visual-novels': 'north', songs: 'west', anime: 'south' };

const rOf = (p: number) => (p / WAI_GUI) * R;
/** 未旋转的坐标：θ 从正上方顺时针（度） */
const at = (theta: number, r: number): [number, number] => [C + r * Math.sin((theta * Math.PI) / 180), C - r * Math.cos((theta * Math.PI) / 180)];
const fmt = (n: number) => n.toFixed(1);

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}

function sector(a0: number, a1: number, r0: number, r1: number) {
  const [x0, y0] = at(a0, r1);
  const [x1, y1] = at(a1, r1);
  const [x2, y2] = at(a1, r0);
  const [x3, y3] = at(a0, r0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${fmt(x0)} ${fmt(y0)}A${r1} ${r1} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}A${r0} ${r0} 0 ${large} 0 ${fmt(x3)} ${fmt(y3)}Z`;
}

interface Star {
  rec: Rec;
  ra: number;
  p: number;
  a: SVGAElement;
}

export function mountBeichen(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-bc]')!;
  const plate = root.querySelector<HTMLElement>('[data-plate]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-sky]')!;
  const readMain = root.querySelector<HTMLElement>('[data-read-main]')!;
  const readSub = root.querySelector<HTMLElement>('[data-read-sub]')!;
  const scEl = root.querySelector<HTMLElement>('[data-sc]')!;
  const clockEl = root.querySelector<HTMLElement>('[data-clock]')!;
  const xiangItems = [...root.querySelectorAll<HTMLLIElement>('[data-xiang] li')];
  const records = loadRecords();

  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.replaceChildren();
  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'bc-clip' }, defs);
  el('circle', { cx: C, cy: C, r: R }, clip);
  // 天汉用细点排出来，像刻本上的点子
  const dots = el('pattern', { id: 'bc-han', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(30)' }, defs);
  el('circle', { cx: 1.5, cy: 1.5, r: 0.9, class: 'han-dot' }, dots);

  // 旋转的天球 + 不转的框
  const turning = el('g', {}, svg);
  const fixed = el('g', {}, svg);

  // ---------- 天汉：银纬 ±7° 的带子，按真实坐标算 ----------
  const band = (b: number) =>
    Array.from({ length: 181 }, (_, i) => {
      const [ra, dec] = galacticToEquatorial(i * 2, b);
      return at(ra, rOf(90 - dec));
    });
  const ring = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`;
  el('path', { d: ring(band(7)) + ring(band(-7)), class: 'han', fill: 'url(#bc-han)', 'fill-rule': 'evenodd', 'clip-path': 'url(#bc-clip)' }, turning);

  // ---------- 三规、黄道 ----------
  el('circle', { cx: C, cy: C, r: rOf(NEI_GUI), class: 'gui nei' }, turning);
  el('circle', { cx: C, cy: C, r: rOf(CHIDAO), class: 'chidao' }, turning);
  const ecl = Array.from({ length: 181 }, (_, i) => {
    const [ra, dec] = eclipticToEquatorial(i * 2);
    return at(ra, rOf(90 - dec));
  });
  el('path', { d: ring(ecl), class: 'huangdao' }, turning);

  // ---------- 二十八宿：宿界线、周天刻度、宿名 ----------
  const wedge = el('path', { class: 'wedge', d: '' }, turning);
  wedge.style.display = 'none';
  const suNames = new Map<string, SVGTextElement>();
  MANSION_SPANS.forEach((m, i) => {
    const edge = i === 0 || MANSION_SPANS[i - 1].xiang !== m.xiang;
    const [x1, y1] = at(m.start, rOf(NEI_GUI));
    const [x2, y2] = at(m.start, RIM);
    el('line', { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2), class: `su-line${edge ? ' xiang-edge' : ''}` }, turning);
    const mid = (m.start + m.end) / 2;
    const [tx, ty] = at(mid, (R + RIM) / 2);
    const t = el('text', { x: fmt(tx), y: fmt(ty), class: 'su-name', transform: `rotate(${fmt(mid)} ${fmt(tx)} ${fmt(ty)})` }, turning);
    t.textContent = m.name;
    suNames.set(m.name, t);
  });
  // 周天 365¼ 度，一度一刻
  let ticks = '';
  for (let g = 0; g < Math.floor(ZHOUTIAN); g++) {
    const a = MANSION_SPANS[0].start + toDeg(g);
    const [x1, y1] = at(a, R);
    const [x2, y2] = at(a, R + (g % 5 === 0 ? 7 : 4));
    ticks += `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
  }
  el('path', { d: ticks, class: 'su-tick' }, turning);
  el('circle', { cx: C, cy: C, r: R, class: 'rim' }, fixed);
  el('circle', { cx: C, cy: C, r: RIM, class: 'rim-in' }, fixed);
  // 子午线：正上方是此刻中天的地方
  el('line', { x1: C, y1: C - RIM, x2: C, y2: C - RIM - 18, class: 'meridian' }, fixed);
  // 三规的名字（不转，写在左下）
  for (const [p, name] of [
    [NEI_GUI, '内规'],
    [CHIDAO, '赤道'],
    [WAI_GUI, '外规'],
  ] as const) {
    const [x, y] = at(214, rOf(p) - 6);
    const t = el('text', { x: fmt(x), y: fmt(y), class: 'gui-name', 'text-anchor': 'end' }, fixed);
    t.textContent = name;
  }

  // ---------- 太阳（唯一的朱色） ----------
  const now = new Date();
  const lamSun = sunLongitude(now);
  const [sunRa, sunDec] = eclipticToEquatorial(lamSun);
  const [sx, sy] = at(sunRa, rOf(90 - sunDec));
  el('circle', { cx: fmt(sx), cy: fmt(sy), r: 13, class: 'sun-ring' }, turning);
  el('circle', { cx: fmt(sx), cy: fmt(sy), r: 6, class: 'sun' }, turning);

  // ---------- 星：每一象里按系列聚在一起排开，去极度分三圈 ----------
  const stars: Star[] = [];
  const guanG = el('g', {}, turning);
  const starG = el('g', {}, turning);
  for (const [cat, x] of Object.entries(CAT_XIANG) as [Rec['category'], Xiang][]) {
    const [a0, a1] = xiangSpan(x);
    const mine = records
      .filter((r) => r.category === cat)
      .sort((a, b) => keyOrder(a.series ?? a.key) - keyOrder(b.series ?? b.key) || keyOrder(a.key) - keyOrder(b.key));
    const slot = ((a1 - a0) * 0.92) / Math.max(mine.length, 1);
    mine.forEach((rec, i) => {
      const ra = a0 + (a1 - a0) * 0.04 + slot * (i + 0.5 + (keyOrder(rec.key + 'j') - 0.5) * 0.5);
      const h = keyOrder(rec.key + 'p');
      // 心头好在内规以内，终年不落；很久以前的贴着外规，快要没进地平线
      const p = rec.favorite ? 21 + h * 11 : rec.date.precision === 'long-ago' ? 118 + h * 22 : 44 + h * 66;
      const [px, py] = at(ra, rOf(p));
      const a = el('a', { href: rec.href, class: `star ${rec.date.precision}${rec.favorite ? ' fav' : ''}`, 'aria-label': rec.title }, starG);
      el('circle', { cx: fmt(px), cy: fmt(py), r: 13, class: 'hit' }, a);
      el('circle', { cx: fmt(px), cy: fmt(py), r: rec.favorite ? 6 : 4.2, class: 'body' }, a);
      stars.push({ rec, ra, p, a });
    });
  }
  // 同一系列：连成一个星官
  const bySeries = new Map<string, Star[]>();
  for (const s of stars) if (s.rec.series) bySeries.set(s.rec.series, [...(bySeries.get(s.rec.series) ?? []), s]);
  for (const group of bySeries.values()) {
    group.sort((a, b) => a.ra - b.ra);
    for (let i = 1; i < group.length; i++) {
      const [x1, y1] = at(group[i - 1].ra, rOf(group[i - 1].p));
      const [x2, y2] = at(group[i].ra, rOf(group[i].p));
      el('line', { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2), class: 'guan' }, guanG);
    }
  }

  // 指着的星的名字：写在不转的那一层
  const nameG = el('g', {}, fixed);
  const name = el('text', { class: 'star-name' }, nameG);

  // ---------- 转动 ----------
  let lst = localSiderealDeg(now);
  let shown = lst;
  const place = (rot: number) => {
    shown = rot;
    turning.setAttribute('transform', `rotate(${fmt(-rot)} ${C} ${C})`);
    for (const li of xiangItems) {
      const x = CAT_XIANG[li.dataset.cat as Rec['category']];
      const [a0, a1] = xiangSpan(x);
      const th = (a0 + a1) / 2 - rot;
      const [px, py] = at(th, RIM + 24);
      li.style.left = `${px / 10}%`;
      li.style.top = `${py / 10}%`;
      // 字贴着圆外沿往外长，不压到宿名
      const sin = Math.sin((th * Math.PI) / 180);
      const cos = Math.cos((th * Math.PI) / 180);
      li.style.transform = `translate(${fmt(-50 + 50 * sin)}%, ${fmt(-50 - 50 * cos)}%)`;
      li.querySelector<HTMLElement>('[data-xn]')!.textContent = XIANG[x].name;
    }
  };
  let raf = 0;
  if (reduced.matches) place(lst);
  else {
    // 打开时，天球从两个时辰前转到此刻（这一页唯一的一段动画）
    const from = lst - 30;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min((t - t0) / 2200, 1);
      place(from + (lst - from) * (1 - Math.pow(1 - k, 3)));
      raf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- 读数 ----------
  const jq = jieqi(now);
  const sunSu = mansionAt(sunRa);
  const idle = () => {
    readMain.textContent = `太阳在${sunSu.name}宿`;
    readMain.removeAttribute('lang');
    readSub.textContent = `${jq.last}后${jq.cn(jq.since)}日，${jq.next}前${jq.cn(jq.until)}日`;
  };
  const tick = () => {
    const d = new Date();
    scEl.textContent = shichen(d);
    clockEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}　北纬 35°`;
    lst = localSiderealDeg(d);
    if (!raf || reduced.matches) place(lst);
  };
  tick();
  idle();
  const timer = window.setInterval(tick, 20000);

  let litSu = '';
  const lightSu = (ra: number | null) => {
    const m = ra === null ? null : mansionAt(ra);
    if ((m?.name ?? '') === litSu) return m;
    if (litSu) suNames.get(litSu)!.classList.remove('on');
    litSu = m?.name ?? '';
    if (!m) {
      wedge.style.display = 'none';
      return m;
    }
    suNames.get(m.name)!.classList.add('on');
    wedge.setAttribute('d', sector(m.start, m.end, rOf(NEI_GUI), R));
    wedge.style.display = '';
    return m;
  };
  const showStar = (s: Star | undefined) => {
    for (const t of stars) t.a.classList.toggle('on', t === s);
    if (!s) {
      name.textContent = '';
      return;
    }
    const [x, y] = at(s.ra - shown, rOf(s.p));
    const right = x < C + 220;
    name.setAttribute('x', fmt(x + (right ? 14 : -14)));
    name.setAttribute('y', fmt(y + 5));
    name.setAttribute('text-anchor', right ? 'start' : 'end');
    name.textContent = s.rec.title;
    if (s.rec.lang) name.setAttribute('lang', s.rec.lang);
    else name.removeAttribute('lang');
    lightSu(s.ra);
    readMain.textContent = s.rec.title;
    if (s.rec.lang) readMain.lang = s.rec.lang;
    else readMain.removeAttribute('lang');
    readSub.textContent = `${s.rec.categoryLabel}　${dateLabel(s.rec.date)}${s.rec.favorite ? '　心头好' : ''}`;
  };
  const starOf = (t: EventTarget | null) => {
    const a = (t as Element | null)?.closest?.('a.star');
    return a ? stars.find((s) => s.a === a) : undefined;
  };
  const onMove = (e: PointerEvent) => {
    const s = starOf(e.target);
    if (s) return showStar(s);
    showStar(undefined);
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const dx = pt.x - C;
    const dy = pt.y - C;
    const r = Math.hypot(dx, dy);
    if (r > RIM || r < 1) {
      lightSu(null);
      idle();
      return;
    }
    const ra = (Math.atan2(dx, -dy) * 180) / Math.PI + shown;
    const m = lightSu(ra)!;
    readMain.textContent = `${m.name}宿`;
    readMain.removeAttribute('lang');
    readSub.textContent = `${XIANG[m.xiang].name}　宿度 ${m.width === 26.25 ? '二十六又四分之一' : jq.cn(m.width)}`;
  };
  const onLeave = () => {
    showStar(undefined);
    lightSu(null);
    idle();
  };
  const onFocus = (e: FocusEvent) => showStar(starOf(e.target));
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', onLeave);
  svg.addEventListener('focusin', onFocus);
  svg.addEventListener('focusout', onLeave);

  // 字号按屏幕像素算：viewBox 里的 1 个单位在屏幕上多大
  const scale = () => plate.style.setProperty('--u', String(1000 / Math.max(plate.clientWidth, 1)));
  const ro = new ResizeObserver(scale);
  ro.observe(plate);
  scale();
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(timer);
    ro.disconnect();
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerleave', onLeave);
    svg.removeEventListener('focusin', onFocus);
    svg.removeEventListener('focusout', onLeave);
  };
}

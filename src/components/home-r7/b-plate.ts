/**
 * PROTOTYPE（首页第七轮 B）：记忆的误差。一张天文玻璃底片（深色的负片），上面的红色是油性铅笔做的标记。
 * 横轴是时间（一年一格），四个类别是四条横带。每条记录按它「记得有多准」画：
 * 到日是一个锐利的点；到月拖一个小椭圆（一个月宽）；到年拖一个长椭圆（一整年宽）；
 * 很久以前的散在左边一片雾里。心头好用红铅笔圈出来；同一系列连线。指一颗星，旁边写出它的日期和「记得多准」。
 */
import { dateLabel, dayOfYear, el, glyph, keyOrder, loadRecords, sampleMode, uncertainty, type Rec } from './r7-data';

const W = 1600;
const H = 900;
const TOP = 130;
const BOTTOM = 790;
const FOG = [150, 330] as const; // 很久以前那片雾的左右边界
const PLOT = [380, 1500] as const;
const BANDS = ['games', 'visual-novels', 'anime', 'songs'] as const;
const BAND_LABEL: Record<string, string> = { games: '游戏', 'visual-novels': '视觉小说', anime: '动画', songs: '音乐' };

const memory = (r: Rec) =>
  r.date.precision === 'day' ? '记得是哪一天' : r.date.precision === 'month' ? '只记得是哪个月' : r.date.precision === 'year' ? '只记得是哪一年' : '记不清了';

export function mountPlate(root: HTMLElement): () => void {
  const svg = root.querySelector<SVGSVGElement>('[data-plate]')!;
  const records = loadRecords();
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const dated = records.filter((r) => r.date.year);
  const years = dated.map((r) => r.date.year!);
  const y0 = years.length ? Math.min(...years) : 2020;
  const y1 = years.length ? Math.max(...years) + 1 : 2026;
  const yearW = (PLOT[1] - PLOT[0]) / Math.max(y1 - y0, 1);
  const xOf = (r: Rec) => PLOT[0] + (r.date.year! - y0 + dayOfYear(r.date)) * yearW;
  const bandH = (BOTTOM - TOP) / BANDS.length;
  const yOf = (r: Rec) => TOP + BANDS.indexOf(r.category) * bandH + bandH * (0.18 + keyOrder(r.key + 'y') * 0.64);

  // ---------- 底片本身 ----------
  el('rect', { x: 0, y: 0, width: W, height: H, class: 'glass' }, svg);
  el('rect', { x: 60, y: 60, width: W - 120, height: H - 120, class: 'frame' }, svg);
  // 四角的对位十字
  for (const [cx, cy] of [
    [60, 60],
    [W - 60, 60],
    [60, H - 60],
    [W - 60, H - 60],
  ])
    el('path', { d: `M${cx - 18} ${cy}H${cx + 18}M${cx} ${cy - 18}V${cy + 18}`, class: 'reg' }, svg);
  // 年份刻度：每年一道，每月一道短的
  for (let y = y0; y <= y1; y++) {
    const x = PLOT[0] + (y - y0) * yearW;
    el('line', { x1: x, y1: TOP - 30, x2: x, y2: BOTTOM + 10, class: 'year-line' }, svg);
    if (y < y1) {
      const label = el('text', { x: x + 6, y: TOP - 40, class: 'year' }, svg);
      label.textContent = String(y);
      for (let m = 1; m < 12; m++) {
        const xm = x + (m / 12) * yearW;
        el('line', { x1: xm, y1: TOP - 30, x2: xm, y2: TOP - 24, class: 'month-tick' }, svg);
      }
    }
  }
  // 类别横带
  BANDS.forEach((b, i) => {
    const y = TOP + i * bandH;
    if (i > 0) el('line', { x1: FOG[0], y1: y, x2: PLOT[1] + 20, y2: y, class: 'band-line' }, svg);
    const label = el('text', { x: 104, y: y + bandH / 2, class: 'band' }, svg);
    label.textContent = BAND_LABEL[b];
  });
  // 很久以前：左边一片雾，虚线框起来
  el('rect', { x: FOG[0], y: TOP - 10, width: FOG[1] - FOG[0], height: BOTTOM - TOP + 20, class: 'fog' }, svg);
  const fogLabel = el('text', { x: (FOG[0] + FOG[1]) / 2, y: BOTTOM + 40, class: 'fog-label' }, svg);
  fogLabel.textContent = '很久以前';
  // 底片的编号和曝光时间
  const caption = el('text', { x: W - 80, y: H - 76, class: 'caption', 'text-anchor': 'end' }, svg);
  caption.textContent = `底片 №${String(records.length).padStart(3, '0')}　曝光 ${y0}—${y1 - 1} 及更早`;

  // ---------- 星 ----------
  const pos = new Map<Rec, [number, number]>();
  const layer = el('g', {}, svg);
  for (const r of records) {
    let x: number;
    const y = yOf(r);
    if (r.date.precision === 'long-ago') x = FOG[0] + 18 + keyOrder(r.key) * (FOG[1] - FOG[0] - 36);
    else x = xOf(r);
    pos.set(r, [x, y]);
  }
  // 同一系列连线（按时间）
  const bySeries = new Map<string, Rec[]>();
  for (const r of records) if (r.series) bySeries.set(r.series, [...(bySeries.get(r.series) ?? []), r]);
  for (const group of bySeries.values()) {
    group.sort((a, b) => pos.get(a)![0] - pos.get(b)![0]);
    for (let i = 1; i < group.length; i++) {
      const [ax, ay] = pos.get(group[i - 1])!;
      const [bx, by] = pos.get(group[i])!;
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'series' }, layer);
    }
  }
  for (const r of records) {
    const [x, y] = pos.get(r)!;
    const a = el('a', { href: r.href, class: `star ${r.date.precision}${r.favorite ? ' fav' : ''}`, 'aria-label': r.title, tabindex: -1 }, layer);
    const u = uncertainty(r.date);
    if (Number.isFinite(u) && u > 0) el('ellipse', { cx: x, cy: y, rx: Math.max((u * yearW) / 2, 6), ry: u >= 1 ? 9 : 6, class: 'err' }, a);
    if (r.date.precision === 'long-ago') el('circle', { cx: x, cy: y, r: 9, class: 'haze' }, a);
    glyph(r.category, x, y, r.favorite ? 4.6 : 3.2, a);
    if (r.favorite) {
      // 红铅笔随手画的圈，首尾不接上
      const rr = 15 + keyOrder(r.key + 'c') * 4;
      el('path', { d: `M${x - rr} ${y + 3}C${x - rr} ${y - rr * 1.1} ${x + rr * 1.2} ${y - rr} ${x + rr} ${y}S${x - rr * 0.6} ${y + rr * 1.2} ${x - rr * 0.9} ${y - 5}`, class: 'pencil' }, a);
    }
  }

  // ---------- 指一颗星：旁边写日期和记得多准（红铅笔的字） ----------
  const note = el('g', { class: 'note' }, svg);
  const noteLine = el('line', {}, note);
  const noteTitle = el('text', { class: 'note-title' }, note);
  const noteSub = el('text', { class: 'note-sub voice' }, note);
  const show = (target: Element | null) => {
    const a = target?.closest('a.star');
    if (!a) {
      note.classList.remove('on');
      return;
    }
    const r = records.find((x) => x.title === a.getAttribute('aria-label') && x.href === a.getAttribute('href'))!;
    const [x, y] = pos.get(r)!;
    const right = x < W - 420;
    const tx = right ? x + 46 : x - 46;
    noteLine.setAttribute('x1', String(x + (right ? 10 : -10)));
    noteLine.setAttribute('y1', String(y - 6));
    noteLine.setAttribute('x2', String(tx));
    noteLine.setAttribute('y2', String(y - 34));
    for (const t of [noteTitle, noteSub]) {
      t.setAttribute('x', String(tx + (right ? 6 : -6)));
      t.setAttribute('text-anchor', right ? 'start' : 'end');
    }
    noteTitle.setAttribute('y', String(y - 38));
    noteSub.setAttribute('y', String(y - 16));
    noteTitle.textContent = r.title;
    if (r.lang) noteTitle.setAttribute('lang', r.lang);
    else noteTitle.removeAttribute('lang');
    noteSub.textContent = `${dateLabel(r.date)}　${memory(r)}`;
    note.classList.add('on');
  };
  const over = (e: Event) => show(e.target as Element);
  svg.addEventListener('pointerover', over);
  svg.addEventListener('focusin', over);
  svg.addEventListener('pointerleave', () => show(null));
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    svg.removeEventListener('pointerover', over);
    svg.removeEventListener('focusin', over);
  };
}

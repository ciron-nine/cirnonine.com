/**
 * PROTOTYPE（首页第七轮）：读数据岛，处理示意日期。三版共用。
 */
export type Precision = 'day' | 'month' | 'year' | 'long-ago';
export interface CDate {
  precision: Precision;
  year?: number;
  month?: number;
  day?: number;
}
export interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: 'games' | 'visual-novels' | 'anime' | 'songs';
  categoryLabel: string;
  favorite: boolean;
  series?: string;
  date: CDate;
}

export const sampleMode = () => new URL(location.href).searchParams.get('sample') === '1';

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

/** 示意日期：按 key 的哈希编，三成记不清，其余散在 2014–2026；精度到日、到月、到年各约三分之一；一成是心头好 */
function sampleDate(key: string): CDate {
  const h = hash(key);
  const h2 = hash(key + '#');
  const h3 = hash(key + '!');
  if (h < 0.3) return { precision: 'long-ago' };
  const year = 2014 + Math.floor(h2 * 13);
  const month = 1 + Math.floor(h3 * 12);
  const day = 1 + Math.floor(hash(key + '?') * 28);
  const p = hash(key + 'p');
  if (p < 0.36) return { precision: 'day', year, month, day };
  if (p < 0.72) return { precision: 'month', year, month };
  return { precision: 'year', year };
}

export function loadRecords(): Rec[] {
  const raw: Rec[] = JSON.parse(document.getElementById('r7-records')?.textContent ?? '[]');
  if (!sampleMode()) return raw;
  return raw.map((r) => ({ ...r, date: sampleDate(r.key), favorite: r.favorite || hash(r.key + 'f') < 0.1 }));
}

/** 一年里的位置（0..1）：到日的取那天，到月的取月中，到年的取年中 */
export function dayOfYear(d: CDate): number {
  if (d.precision === 'day') return ((d.month! - 1) * 30.44 + d.day! - 0.5) / 365.25;
  if (d.precision === 'month') return ((d.month! - 1) * 30.44 + 15.2) / 365.25;
  return 0.5;
}

/** 这个日期记得有多模糊（以年计的跨度）：到日 0，到月 1/12，到年 1 */
export function uncertainty(d: CDate): number {
  return d.precision === 'day' ? 0 : d.precision === 'month' ? 1 / 12 : d.precision === 'year' ? 1 : Infinity;
}

export function dateLabel(d: CDate): string {
  if (d.precision === 'day') return `${d.year}年${d.month}月${d.day}日`;
  if (d.precision === 'month') return `${d.year}年${d.month}月`;
  if (d.precision === 'year') return `${d.year}年`;
  return '很久以前';
}

export const keyOrder = (k: string) => hash(k);

export const SVG = 'http://www.w3.org/2000/svg';
export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.append(node);
  return node;
}

/** 类别的星形：游戏实心圆、视觉小说菱形、动画空心圆、音乐四芒星（单一强调色留给「当前」和心头好） */
export function glyph(category: Rec['category'], x: number, y: number, s: number, parent: Element) {
  const g = el('g', { class: `glyph ${category}` }, parent);
  if (category === 'games') el('circle', { cx: x, cy: y, r: s }, g);
  else if (category === 'visual-novels') el('path', { d: `M${x} ${y - s * 1.3}L${x + s * 1.1} ${y}L${x} ${y + s * 1.3}L${x - s * 1.1} ${y}Z` }, g);
  else if (category === 'anime') el('circle', { cx: x, cy: y, r: s, class: 'hollow' }, g);
  else el('path', { d: `M${x} ${y - s * 1.6}Q${x} ${y} ${x + s * 1.6} ${y}Q${x} ${y} ${x} ${y + s * 1.6}Q${x} ${y} ${x - s * 1.6} ${y}Q${x} ${y} ${x} ${y - s * 1.6}Z` }, g);
  return g;
}

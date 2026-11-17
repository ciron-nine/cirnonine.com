/**
 * PROTOTYPE（首页第十轮）：视星等。读数据岛，给每条记录算星等和星名。
 *
 * 星等是喜帕恰斯（约前 130 年）编第一部星表时的分法：按肉眼看上去多亮分成六等，一等最亮，六等是肉眼刚刚能看见的。
 * 1856 年普森把它定成数：差五等，亮度差一百倍，所以差一等就差 100^(1/5) ≈ 2.512 倍。
 * 它量的是「从这里看过去有多亮」，不是星本身多亮——这一页的星等也一样：量的是这件作品在我这里留下了多少，
 * 不是它好不好。心头好一等；写过长评二等；写过短评三等；只记得日子四等；只记得年份四等半；很久以前在六等上下，
 * 有一些已经暗过了肉眼的极限。同一个数（2.512 的四次方根，10^0.1 ≈ 1.259）还决定星的大小、字号和灰度，见 Atlas.astro。
 *
 * 星名用拜耳命名法（1603）：每个天区里按亮度排，最亮的叫 α，往下 β、γ……；希腊字母用完了接着用数字（弗兰斯蒂德那样）。
 * ?sample=1 时编示意的日期、心头好和评论（真实内容里几乎都是「很久以前」、还没写评论），页面上会标出来。
 */
export type Precision = 'day' | 'month' | 'year' | 'long-ago';
export type Category = 'games' | 'visual-novels' | 'anime' | 'songs';
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
  category: Category;
  categoryLabel: string;
  favorite: boolean;
  series?: string;
  date: CDate;
  review?: 'long' | 'short';
}
export interface Entry extends Rec {
  mag: number;
  designation: string;
}

export const sampleMode = () => new URL(location.href).searchParams.get('sample') === '1';

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

function sampleDate(key: string): CDate {
  if (hash(key) < 0.3) return { precision: 'long-ago' };
  const year = 2014 + Math.floor(hash(key + '#') * 12);
  const month = 1 + Math.floor(hash(key + '!') * 12);
  const day = 1 + Math.floor(hash(key + '?') * 28);
  const p = hash(key + 'p');
  if (p < 0.36) return { precision: 'day', year, month, day };
  if (p < 0.72) return { precision: 'month', year, month };
  return { precision: 'year', year };
}

function loadRaw(): Rec[] {
  const raw: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  if (!sampleMode()) return raw;
  return raw.map((r) => {
    const h = hash(r.key + 'r');
    return {
      ...r,
      date: sampleDate(r.key),
      favorite: r.favorite || hash(r.key + 'f') < 0.08,
      review: r.review ?? (h < 0.12 ? 'long' : h < 0.3 ? 'short' : undefined),
    };
  });
}

/** 星等：等级由「我留下了多少」定，等级里再按键散开一点，免得一样亮的星排成一排 */
export function magnitude(r: Rec): number {
  const j = hash(r.key + 'm');
  if (r.favorite) return 1 + j * 0.5;
  if (r.review === 'long') return 2 + j * 0.5;
  if (r.review === 'short') return 3 + j * 0.5;
  if (r.date.precision === 'day' || r.date.precision === 'month') return 4 + j * 0.5;
  if (r.date.precision === 'year') return 4.6 + j * 0.5;
  return 5.4 + j;
}

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';

export function loadEntries(): Entry[] {
  const recs = loadRaw();
  const out: Entry[] = recs.map((r) => ({ ...r, mag: magnitude(r), designation: '' }));
  for (const cat of new Set(out.map((e) => e.category))) {
    out
      .filter((e) => e.category === cat)
      .sort((a, b) => a.mag - b.mag)
      .forEach((e, i) => (e.designation = i < GREEK.length ? GREEK[i] : String(i + 1)));
  }
  return out;
}

/** 视星等写成一位小数 */
export const magLabel = (m: number) => m.toFixed(1);

export function dateLabel(d: CDate): string {
  if (d.precision === 'day') return `${d.year}年${d.month}月${d.day}日`;
  if (d.precision === 'month') return `${d.year}年${d.month}月`;
  if (d.precision === 'year') return `${d.year}年`;
  return '很久以前';
}

/** 完成的先后，数越大越新；很久以前最小 */
export function when(d: CDate): number {
  if (!d.year) return -Infinity;
  return d.year * 400 + (d.month ?? 6.5) * 31 + (d.day ?? 15);
}

/** 打开时星按星等出来：黄昏里先看见一等星，天越黑看见的越暗 */
export const NAKED_EYE = 6;
/** 放大 z 倍时能看见的最暗星等：口径每大一倍，极限星等加 5·log10(2) ≈ 1.5 */
export const limitingMagnitude = (z: number) => NAKED_EYE + 5 * Math.log10(z);

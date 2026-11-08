/**
 * PROTOTYPE 变体 B：每条记录在星图上的位置和亮度。构建时算好写进 HTML，
 * 静态后备（CSS 圆点 + 链接）和 WebGL 层读同一份位置，两层对得上。
 *
 * 位置是椭圆极坐标：ρ 是离中心的远近（0 中心，1 边缘），θ 是角度。
 * 完成日期越近离中心越近；「很久以前」在最外一圈。角度用黄金角按哈希顺序排开，不扎堆。
 */
import type { CompletionDate } from '../../lib/completion-date';
import { hash01 } from './hash';
import type { HeroRecord } from './hero-data';

export interface Star {
  record: HeroRecord;
  rho: number;
  theta: number;
  /** 亮度 0..1：心头好更亮 */
  mag: number;
}

export interface Ring {
  rho: number;
  label: string;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** 有日期的记录分布在 [INNER, DATED_OUTER]，「很久以前」在 [LONG_AGO, 0.97] */
const INNER = 0.1;
const DATED_OUTER = 0.74;
const LONG_AGO = 0.86;
/** 多少年前的记录落到 DATED_OUTER；更早的也压在这一圈以内 */
const SPAN_YEARS = 10;

/** 完成日期距 now 有多少年（取所在时段的中点） */
function yearsAgo(date: CompletionDate, now: Date): number | undefined {
  const nowYears = now.getUTCFullYear() + now.getUTCMonth() / 12;
  switch (date.precision) {
    case 'day':
      return nowYears - (date.year + (date.month - 1 + date.day / 31) / 12);
    case 'month':
      return nowYears - (date.year + (date.month - 0.5) / 12);
    case 'year':
      return nowYears - (date.year + 0.5);
    case 'long-ago':
      return undefined;
  }
}

/** 相邻两圈至少隔这么远才画 */
const MIN_RING_GAP = 0.1;

/** 年数到半径：指数小于 1，让最近几年展开得更开一点 */
function rhoForYears(years: number): number {
  const t = Math.min(Math.max(years, 0) / SPAN_YEARS, 1);
  return INNER + (DATED_OUTER - INNER) * Math.pow(t, 0.75);
}

export function layoutStars(records: HeroRecord[], now: Date): { stars: Star[]; rings: Ring[] } {
  const ordered = [...records].sort((a, b) => hash01(a.key) - hash01(b.key));
  const stars = ordered.map((record, i) => {
    const ago = yearsAgo(record.date, now);
    const jitter = hash01(record.key, 11) - 0.5;
    const rho =
      ago === undefined
        ? LONG_AGO + (0.97 - LONG_AGO) * (jitter + 0.5)
        : rhoForYears(ago + jitter * (record.date.precision === 'year' ? 0.8 : 0.15));
    return {
      record,
      rho,
      theta: i * GOLDEN + jitter * 0.3,
      mag: record.favorite ? 1 : 0.35 + hash01(record.key, 12) * 0.25,
    };
  });

  // 只画有记录的年份圈；最外圈是「很久以前」
  const thisYear = now.getUTCFullYear();
  const years = new Set<number>();
  for (const { record } of stars) {
    if (record.date.precision !== 'long-ago') years.add(record.date.year);
  }
  // 圈画在这一年的开头（更早的一侧），标签是年份；和上一圈挨得太近的不画，免得标签叠在一起
  const rings: Ring[] = [];
  for (const y of [...years].filter((y) => thisYear - y <= SPAN_YEARS).sort((a, b) => b - a)) {
    const rho = rhoForYears(now.getUTCFullYear() + now.getUTCMonth() / 12 - y);
    if (rings.length === 0 || rho - rings[rings.length - 1].rho >= MIN_RING_GAP) rings.push({ rho, label: String(y) });
  }
  if (stars.some((s) => s.record.date.precision === 'long-ago')) {
    if (rings.length && LONG_AGO - 0.04 - rings[rings.length - 1].rho < MIN_RING_GAP) rings.pop();
    rings.push({ rho: LONG_AGO - 0.04, label: '很久以前' });
  }
  return { stars, rings };
}

/** 椭圆的两个半轴占主视觉宽、高的比例；手机上主视觉是方的，就是圆 */
export const ELLIPSE = { rx: 0.46, ry: 0.44 };

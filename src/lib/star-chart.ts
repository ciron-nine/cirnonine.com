/**
 * 首页的记录星图：每条记录是一颗星，构建时算好位置和名字的位置，StarChart.astro 画出来。
 *
 * 星的位置：一个类别一个天区（90° 的扇形）。有日期的按完成先后排，越新的越靠中心；
 * 「很久以前」的落在最外面一圈。天区里的角度用黄金角（0.618…）分布，记录再多也均匀散开，不会挤成一圈。
 *
 * 名字（标签）不重叠：分三个缩放级别（1×、2×、4×）各算一次。每颗星在周围八个方向里挑第一个
 * 不压住别的名字、也不压住别的星的位置；哪个方向都放不下，这一级就不显示它的名字，放大到下一级再看。
 * 先放心头好，再放最近完成的，最后是很久以前的。放到最大（4×）时每颗星都要有名字：
 * 这一级哪个方向都放不下的，就放在右边，允许和别的名字挨得近一点。
 */
import { compareCompletionDates, type CompletionDate } from './completion-date';
import type { CategoryKey, HomeData, HomeRecord } from './home-data';

export const C = 500;
export const DISC = 482;
export const LEVELS = [1, 2, 4] as const;
export type Level = (typeof LEVELS)[number];
/** 1× 时名字的字号（星图坐标里的单位）；放大后按比例变小，屏幕上看起来一样大 */
export const LABEL_SIZE = 11;

export interface ChartRecord {
  key: string;
  category: CategoryKey;
  title: string;
  lang?: 'ja';
  href?: string;
  favorite: boolean;
  date: CompletionDate;
  series?: string;
}

export interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}

export interface Star {
  rec: ChartRecord;
  x: number;
  y: number;
  size: number;
  /** 出现的先后（按完成日期，越早越先），打开页面时按这个顺序一颗颗印上去 */
  order: number;
  labels: Partial<Record<Level, Label>>;
}

const GOLDEN = 0.6180339887;

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

/** 名字的宽度（以字号为单位），按思源黑体的大致字宽估：汉字、假名、全角 1，大写 0.68，小写和数字 0.57，空格 0.28，标点 0.36 */
function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[⺀-￯]/.test(ch)) w += 1;
    else if (/[A-Z]/.test(ch)) w += 0.68;
    else if (/[a-z0-9]/.test(ch)) w += 0.57;
    else if (ch === ' ') w += 0.28;
    else w += 0.36;
  }
  return w;
}

function toChartRecord(r: HomeRecord): ChartRecord {
  return {
    key: `${r.category}/${r.slug}`,
    category: r.category,
    title: r.originalTitle,
    lang: r.lang,
    href: r.href,
    favorite: r.favorite,
    date: r.date,
    series: r.series,
  };
}

export function starChart(data: Pick<HomeData, 'categories'>) {
  const records = data.categories.flatMap((c) => c.records.map(toChartRecord));
  const categories = data.categories.map((c) => ({
    key: c.key,
    label: c.label,
    href: c.href,
    count: records.filter((r) => r.category === c.key).length,
  }));

  // 有日期的按新到旧排名（全站一起排），决定离中心多远
  const dated = records.filter((r) => r.date.precision !== 'long-ago').sort((a, b) => compareCompletionDates(a.date, b.date));
  const rank = new Map(dated.map((r, i) => [r, dated.length > 1 ? i / (dated.length - 1) : 0]));
  const chronological = [...records].sort((a, b) => compareCompletionDates(b.date, a.date) || hash(a.key) - hash(b.key));
  const order = new Map(chronological.map((r, i) => [r, i]));

  const stars: Star[] = [];
  categories.forEach((cat, k) => {
    const theta0 = ((k * 90 + 6) * Math.PI) / 180;
    const span = (78 * Math.PI) / 180;
    const mine = records.filter((r) => r.category === cat.key);
    const recent = mine.filter((r) => r.date.precision !== 'long-ago').sort((a, b) => rank.get(a)! - rank.get(b)!);
    const old = mine.filter((r) => r.date.precision === 'long-ago').sort((a, b) => hash(a.key) - hash(b.key));
    const place = (r: ChartRecord, radius: number, j: number) => {
      const ang = theta0 + span * (((j + 0.5) * GOLDEN + hash(cat.key) * 0.3) % 1);
      const size = r.favorite ? 6.5 : 2.2 + hash(r.key) * 2.2;
      stars.push({ rec: r, x: C + Math.cos(ang) * radius, y: C + Math.sin(ang) * radius, size, order: order.get(r)!, labels: {} });
    };
    // 有日期的：60–330，按面积均匀（开平方），越新越靠里
    recent.forEach((r, j) => place(r, 60 + 270 * Math.sqrt(rank.get(r)!), j));
    // 很久以前：最外一圈 345–468，也按面积均匀
    old.forEach((r, j) => {
      const t = (j + 0.5) / old.length;
      place(r, Math.sqrt(345 ** 2 + (468 ** 2 - 345 ** 2) * t), j);
    });
  });

  // 名字的位置，每个缩放级别单独算
  const priority = [...stars].sort(
    (a, b) =>
      Number(b.rec.favorite) - Number(a.rec.favorite) ||
      Number(a.rec.date.precision === 'long-ago') - Number(b.rec.date.precision === 'long-ago') ||
      (rank.get(a.rec) ?? 1) - (rank.get(b.rec) ?? 1) ||
      hash(a.rec.key) - hash(b.rec.key),
  );
  type Box = [number, number, number, number];
  const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  for (const level of LEVELS) {
    const fs = LABEL_SIZE / level;
    const dots: Box[] = stars.map((s) => {
      const r = s.size + 1.5;
      return [s.x - r, s.y - r, s.x + r, s.y + r];
    });
    const placed: Box[] = [];
    for (const s of priority) {
      const w = textWidth(s.rec.title) * fs;
      const h = fs * 1.2;
      // 每个名字四周留一点空，免得贴在一起
      const pad = fs * 0.3;
      const d = s.size + 3.5 / level;
      const candidates: [Label, Box][] = [
        [{ x: s.x + d, y: s.y + fs * 0.35, anchor: 'start' }, [s.x + d, s.y - h / 2, s.x + d + w, s.y + h / 2]],
        [{ x: s.x - d, y: s.y + fs * 0.35, anchor: 'end' }, [s.x - d - w, s.y - h / 2, s.x - d, s.y + h / 2]],
        [{ x: s.x + d * 0.7, y: s.y - d * 0.7, anchor: 'start' }, [s.x + d * 0.7, s.y - d * 0.7 - h * 0.85, s.x + d * 0.7 + w, s.y - d * 0.7 + h * 0.15]],
        [{ x: s.x + d * 0.7, y: s.y + d * 0.7 + fs * 0.8, anchor: 'start' }, [s.x + d * 0.7, s.y + d * 0.7, s.x + d * 0.7 + w, s.y + d * 0.7 + h]],
        [{ x: s.x - d * 0.7, y: s.y - d * 0.7, anchor: 'end' }, [s.x - d * 0.7 - w, s.y - d * 0.7 - h * 0.85, s.x - d * 0.7, s.y - d * 0.7 + h * 0.15]],
        [{ x: s.x - d * 0.7, y: s.y + d * 0.7 + fs * 0.8, anchor: 'end' }, [s.x - d * 0.7 - w, s.y + d * 0.7, s.x - d * 0.7, s.y + d * 0.7 + h]],
        [{ x: s.x, y: s.y - d - fs * 0.15, anchor: 'middle' }, [s.x - w / 2, s.y - d - h, s.x + w / 2, s.y - d]],
        [{ x: s.x, y: s.y + d + fs * 0.85, anchor: 'middle' }, [s.x - w / 2, s.y + d, s.x + w / 2, s.y + d + h]],
      ];
      for (const [label, box] of candidates) {
        const inside = [
          [box[0], box[1]],
          [box[2], box[1]],
          [box[0], box[3]],
          [box[2], box[3]],
        ].every(([x, y]) => Math.hypot(x - C, y - C) < DISC - 4);
        if (!inside) continue;
        const padded: Box = [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad];
        if (placed.some((p) => overlaps(p, padded))) continue;
        if (dots.some((dot, i) => stars[i] !== s && overlaps(dot, box))) continue;
        placed.push(box);
        s.labels[level] = label;
        break;
      }
      if (level === 4 && !s.labels[4]) s.labels[4] = candidates[0][0];
    }
  }

  // 同一系列连成星座（按完成先后）
  const lines: { a: Star; b: Star; series: string }[] = [];
  const bySeries = new Map<string, Star[]>();
  for (const s of stars) if (s.rec.series) bySeries.set(s.rec.series, [...(bySeries.get(s.rec.series) ?? []), s]);
  for (const [series, group] of bySeries) {
    group.sort((a, b) => a.order - b.order);
    for (let i = 1; i < group.length; i++) lines.push({ a: group[i - 1], b: group[i], series });
  }

  // 背景的暗星，四颗里有一颗会闪
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const field = Array.from({ length: 900 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 480;
    return { x: C + Math.cos(a) * rr, y: C + Math.sin(a) * rr, s: 0.4 + Math.pow(rand(), 3) * 1.6, twinkle: i % 4 === 0, delay: rand() * 6 };
  });

  // 阶梯状的天区边界：沿赤经、赤纬走的折线，像 IAU 的星座边界
  const boundary = (deg: number) => {
    const pts: string[] = [];
    let a = deg;
    const p = (ang: number, r: number) =>
      `${(C + Math.cos((ang * Math.PI) / 180) * r).toFixed(1)} ${(C + Math.sin((ang * Math.PI) / 180) * r).toFixed(1)}`;
    for (let rr = 60; rr <= 480; rr += 60) {
      const jog = (hash(`${deg}/${rr}`) - 0.5) * 10;
      pts.push(p(a, rr));
      a = deg + jog;
      pts.push(p(a, rr));
    }
    return `M${pts.join(' L')}`;
  };

  /** 每个天区的中心（缩放到这个天区时对准这里） */
  const regions = categories.map((cat, k) => {
    const ang = ((k * 90 + 45) * Math.PI) / 180;
    return { ...cat, x: C + Math.cos(ang) * 215, y: C + Math.sin(ang) * 215, fx: C + Math.cos(ang) * 290, fy: C + Math.sin(ang) * 290 };
  });

  return { stars, lines, field, boundaries: [0, 90, 180, 270].map(boundary), regions, total: records.length };
}

export type StarChartData = ReturnType<typeof starChart>;

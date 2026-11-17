/**
 * PROTOTYPE（首页第十一轮）：星和名字的位置。
 * - 方向：一个类别一个天区（90° 的扇形），同一系列排在一起
 * - 离中心多远：温度。最热的 O 型在里面，最冷的 M 型在外缘，七型各占一圈；各型的分界画成圆——星图的网格就是光谱序列
 * 所有的星一样大：这张图上没有谁比谁亮。
 * 名字分三个缩放级别（1×、2×、4×）各算一次，每颗星在周围八个方向里挑第一个不压住别的名字和星的位置；放到最大时每颗都标。
 */
import { CENTER as C, RADIUS as DISC } from '../../lib/star-chart-frame';
import { hash, type Entry } from './data';
import { CLASSES } from './spectrum';

export const LEVELS = [1, 2, 4] as const;
export type Level = (typeof LEVELS)[number];
export const LABEL_SIZE = 13;
export const STAR_R = 4.2;
export const CATEGORIES = ['games', 'visual-novels', 'anime', 'songs'] as const;

const R_HOT = 52;
const R_COOL = 466;
/**
 * 温度 → 半径：七型各占一圈一样宽的带子（像音阶里的一级一级），带子里面按对数温度排。
 * 这样每一型都看得清，不会因为 O 型的温度跨度在对数上很窄就挤成一团。
 */
export function radiusOf(T: number, jitter = 0.5) {
  const i = Math.max(CLASSES.findIndex((c) => T >= c.cool), 0);
  const c = CLASSES[i] ?? CLASSES[CLASSES.length - 1];
  const t = Math.min(Math.max(T, c.cool), c.hot);
  const f = Math.log(c.hot / t) / Math.log(c.hot / c.cool);
  const band = (R_COOL - R_HOT) / CLASSES.length;
  // 同一个温度的星不要叠在同一圈上：在带子里错开一点
  return R_HOT + band * (i + 0.08 + 0.84 * Math.min(Math.max(f * 0.8 + jitter * 0.2, 0), 1));
}
export const bandEdge = (i: number) => R_HOT + ((R_COOL - R_HOT) / CLASSES.length) * i;

export interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}
export interface Star {
  e: Entry;
  x: number;
  y: number;
  labels: Partial<Record<Level, Label>>;
}

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

export function layout(entries: Entry[]) {
  const stars: Star[] = [];
  CATEGORIES.forEach((cat, k) => {
    const a0 = k * 90 + 7;
    const span = 76;
    const mine = entries
      .filter((e) => e.category === cat)
      .sort((a, b) => hash(a.series ?? a.key) - hash(b.series ?? b.key) || hash(a.key) - hash(b.key));
    const slot = span / Math.max(mine.length, 1);
    mine.forEach((e, j) => {
      const deg = a0 + slot * (j + 0.5 + (hash(e.key + 'j') - 0.5) * 0.4);
      const ang = (deg * Math.PI) / 180;
      const r = radiusOf(e.T, hash(e.key + 'r'));
      stars.push({ e, x: C + Math.cos(ang) * r, y: C + Math.sin(ang) * r, labels: {} });
    });
  });

  const order = [...stars].sort((a, b) => hash(a.e.key + 'o') - hash(b.e.key + 'o'));
  type Box = [number, number, number, number];
  const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  for (const level of LEVELS) {
    const fs = LABEL_SIZE / level;
    const dots: Box[] = stars.map((s) => {
      const r = STAR_R + 1.5;
      return [s.x - r, s.y - r, s.x + r, s.y + r];
    });
    const placed: Box[] = [];
    for (const s of order) {
      const w = textWidth(s.e.title) * fs;
      const h = fs * 1.2;
      const pad = fs * 0.3;
      const d = STAR_R + 4 / level;
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

  // 同一系列连起来（像星座连线），按方向排
  const lines: [Star, Star][] = [];
  const bySeries = new Map<string, Star[]>();
  for (const s of stars) if (s.e.series) bySeries.set(s.e.series, [...(bySeries.get(s.e.series) ?? []), s]);
  for (const group of bySeries.values()) {
    group.sort((a, b) => Math.atan2(a.y - C, a.x - C) - Math.atan2(b.y - C, b.x - C));
    for (let i = 1; i < group.length; i++) lines.push([group[i - 1], group[i]]);
  }

  // 天区：四条径向的分界线，名字写在外缘
  const regions = CATEGORIES.map((cat, k) => {
    const ang = ((k * 90 + 45) * Math.PI) / 180;
    return { cat, ang, fx: C + Math.cos(ang) * 290, fy: C + Math.sin(ang) * 290 };
  });
  // 各型的分界圆
  const rings = CLASSES.slice(1).map((c, i) => ({ cls: c.cls, r: bandEdge(i + 1) }));

  return { stars, lines, regions, rings };
}

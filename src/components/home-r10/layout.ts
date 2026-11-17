/**
 * PROTOTYPE（首页第十轮）：星和名字的位置。位置沿用 main 上的记录星图（lib/star-chart.ts）：
 * 一个类别一个天区；有日期的越新越靠中心，很久以前在最外一圈；天区里的角度按黄金角散开。
 * 变的是两件事，都出自星等：
 * - 星的半径：r = 7 × 10^(−0.1 × (m − 1))，暗一等小 1.259 倍（和字号同一个比）
 * - 名字：像真的星图一样只给看得见的星标名。三个缩放级别对应三个极限星等（6.0 / 7.5 / 9.0），
 *   比极限暗的星这一级不标名；能标的按从亮到暗的顺序挑不重叠的位置。放到最大时每颗都标。
 */
import { CENTER as C, RADIUS as DISC } from '../../lib/star-chart-frame';
import { hash, limitingMagnitude, when, type Entry } from './data';

export const LEVELS = [1, 2, 4] as const;
export type Level = (typeof LEVELS)[number];
export const LABEL_SIZE = 13;
const GOLDEN = 0.6180339887;
export const CATEGORIES = ['games', 'visual-novels', 'anime', 'songs'] as const;

export interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}
export interface Star {
  e: Entry;
  x: number;
  y: number;
  r: number;
  labels: Partial<Record<Level, Label>>;
}

export const radiusOf = (mag: number) => 7 * Math.pow(10, -0.1 * (mag - 1));

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
  const dated = entries.filter((e) => e.date.precision !== 'long-ago').sort((a, b) => when(b.date) - when(a.date));
  const rank = new Map(dated.map((e, i) => [e, dated.length > 1 ? i / (dated.length - 1) : 0]));

  const stars: Star[] = [];
  CATEGORIES.forEach((cat, k) => {
    const theta0 = ((k * 90 + 6) * Math.PI) / 180;
    const span = (78 * Math.PI) / 180;
    const mine = entries.filter((e) => e.category === cat);
    const recent = mine.filter((e) => e.date.precision !== 'long-ago').sort((a, b) => rank.get(a)! - rank.get(b)!);
    const old = mine.filter((e) => e.date.precision === 'long-ago').sort((a, b) => hash(a.key) - hash(b.key));
    const place = (e: Entry, radius: number, j: number) => {
      const ang = theta0 + span * (((j + 0.5) * GOLDEN + hash(cat) * 0.3) % 1);
      stars.push({ e, x: C + Math.cos(ang) * radius, y: C + Math.sin(ang) * radius, r: radiusOf(e.mag), labels: {} });
    };
    recent.forEach((e, j) => place(e, 60 + 270 * Math.sqrt(rank.get(e)!), j));
    old.forEach((e, j) => place(e, Math.sqrt(345 ** 2 + (468 ** 2 - 345 ** 2) * ((j + 0.5) / old.length)), j));
  });

  // 名字：从亮到暗
  const byMag = [...stars].sort((a, b) => a.e.mag - b.e.mag);
  type Box = [number, number, number, number];
  const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  for (const level of LEVELS) {
    const limit = limitingMagnitude(level);
    const fs = LABEL_SIZE / level;
    const dots: Box[] = stars.map((s) => {
      const r = s.r + 1.5;
      return [s.x - r, s.y - r, s.x + r, s.y + r];
    });
    const placed: Box[] = [];
    for (const s of byMag) {
      if (s.e.mag > limit && level < 4) continue;
      const w = textWidth(s.e.title) * fs;
      const h = fs * 1.2;
      const pad = fs * 0.3;
      const d = s.r + 3.5 / level;
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
      // 放到最大时每颗都标；一、二等星在哪一级都要有名字（亮星总是标名的）
      if (!s.labels[level] && (level === 4 || s.e.mag < 2.5)) s.labels[level] = candidates[0][0];
    }
  }

  // 同一系列连成星座（按完成先后）
  const lines: [Star, Star][] = [];
  const bySeries = new Map<string, Star[]>();
  for (const s of stars) if (s.e.series) bySeries.set(s.e.series, [...(bySeries.get(s.e.series) ?? []), s]);
  for (const group of bySeries.values()) {
    group.sort((a, b) => when(a.e.date) - when(b.e.date) || hash(a.e.key) - hash(b.e.key));
    for (let i = 1; i < group.length; i++) lines.push([group[i - 1], group[i]]);
  }

  // 阶梯状的天区边界（沿赤经、赤纬走的折线，像 IAU 的星座边界）
  const boundary = (deg: number) => {
    const pts: string[] = [];
    let a = deg;
    const p = (ang: number, r: number) => `${(C + Math.cos((ang * Math.PI) / 180) * r).toFixed(1)} ${(C + Math.sin((ang * Math.PI) / 180) * r).toFixed(1)}`;
    for (let rr = 60; rr <= 480; rr += 60) {
      const jog = (hash(`${deg}/${rr}`) - 0.5) * 10;
      pts.push(p(a, rr));
      a = deg + jog;
      pts.push(p(a, rr));
    }
    return `M${pts.join(' L')}`;
  };
  const regions = CATEGORIES.map((cat, k) => {
    const ang = ((k * 90 + 45) * Math.PI) / 180;
    return { cat, x: C + Math.cos(ang) * 215, y: C + Math.sin(ang) * 215, fx: C + Math.cos(ang) * 290, fy: C + Math.sin(ang) * 290 };
  });

  return { stars, lines, boundaries: [0, 90, 180, 270].map(boundary), regions };
}

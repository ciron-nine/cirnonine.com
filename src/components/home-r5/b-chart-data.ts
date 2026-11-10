/**
 * PROTOTYPE（首页第五轮 B）：记录星图的几何，构建时算好，VariantB.astro 画出来。
 */
import type { HomeData, HomeRecord } from '../home-hero-prototype/home-data';
import { compareCompletionDates } from '../../lib/completion-date';

export const C = 500;

export interface Star {
  r: HomeRecord;
  x: number;
  y: number;
  size: number;
  label: { x: number; y: number; anchor: string };
}

export function chart(data: HomeData) {
  const hash = (s: string) => {
    let h = 2166136261;
    for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
    return h / 4294967296;
  };

  // 全部记录按完成日期排，越新的越靠中心；很久以前的散在外圈
  const all = data.categories.flatMap((c) => c.records);
  const ordered = [...all].sort((a, b) => compareCompletionDates(a.date, b.date));
  const rank = new Map(ordered.map((r, i) => [r, i]));
  const stars: Star[] = data.categories.flatMap((cat, k) =>
    cat.records.map((r, i) => {
      const h = hash(`${cat.key}/${r.slug}`);
      const a0 = (k * 90 + 8) * (Math.PI / 180);
      const span = 74 * (Math.PI / 180);
      const ang = a0 + span * ((i + 0.5) / cat.records.length) + (h - 0.5) * 0.08;
      const longAgo = r.date.precision === 'long-ago';
      const rad = longAgo ? 300 + h * 150 : 90 + (rank.get(r)! / Math.max(all.length - 1, 1)) * 260;
      const x = C + Math.cos(ang) * rad;
      const y = C + Math.sin(ang) * rad;
      const size = r.favorite ? 7.5 : 2.6 + hash(r.slug) * 2.4;
      const right = Math.cos(ang) >= 0;
      return { r, x, y, size, label: { x: x + (right ? size + 4 : -(size + 4)), y: y + 3, anchor: right ? 'start' : 'end' } };
    }),
  );

  // 同一系列连成星座（按完成先后）
  const lines: [Star, Star][] = [];
  const bySeries = new Map<string, Star[]>();
  for (const s of stars) if (s.r.series) bySeries.set(s.r.series, [...(bySeries.get(s.r.series) ?? []), s]);
  for (const group of bySeries.values()) for (let i = 1; i < group.length; i++) lines.push([group[i - 1], group[i]]);

  // 背景的暗星
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const field = Array.from({ length: 900 }, () => {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 480;
    return { x: C + Math.cos(a) * rr, y: C + Math.sin(a) * rr, s: 0.4 + Math.pow(rand(), 3) * 1.6 };
  });

  // 阶梯状的天区边界：沿赤经、赤纬走的折线，像 IAU 的星座边界
  const boundary = (deg: number) => {
    const pts: string[] = [];
    let a = deg;
    for (let rr = 60; rr <= 480; rr += 60) {
      const jog = (hash(`${deg}/${rr}`) - 0.5) * 10;
      const p = (ang: number, r: number) => `${(C + Math.cos((ang * Math.PI) / 180) * r).toFixed(1)} ${(C + Math.sin((ang * Math.PI) / 180) * r).toFixed(1)}`;
      pts.push(p(a, rr));
      a = deg + jog;
      pts.push(p(a, rr));
    }
    return `M${pts.join(' L')}`;
  };

  return { stars, lines, field, boundary };
}

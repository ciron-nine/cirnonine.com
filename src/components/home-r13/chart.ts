/**
 * PROTOTYPE（首页第十三轮）：一片想象的海域。只放几何：海底的高度场、等深线、海岸线、灯放在哪。
 * 高度场：几座岛（高斯隆起）加一点分形起伏；高度 > 0 是陆地，< 0 是海，深度 = −高度 × 120 米。
 * 等深线用 marching squares 求出来，按海图的习惯取 5、10、20、50、100、200 米。
 */
import { hash } from './lights';

export const DEPTHS = [5, 10, 20, 50, 100, 200];
const SCALE = 120; // 高度场 1 个单位 = 120 米

function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function noise2(seed: number) {
  const r = rng(seed);
  const g = Array.from({ length: 256 }, () => r() * Math.PI * 2);
  const perm = Array.from({ length: 512 }, (_, i) => Math.floor(hash(`p${seed}-${i & 255}`) * 256));
  const grad = (ix: number, iy: number, x: number, y: number) => {
    const a = g[perm[(perm[ix & 255] + iy) & 511] & 255];
    return Math.cos(a) * x + Math.sin(a) * y;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fade(fx);
    const v = fade(fy);
    const n00 = grad(ix, iy, fx, fy);
    const n10 = grad(ix + 1, iy, fx - 1, fy);
    const n01 = grad(ix, iy + 1, fx, fy - 1);
    const n11 = grad(ix + 1, iy + 1, fx - 1, fy - 1);
    return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
  };
}

export interface Sea {
  /** 高度场在网格上的值，cols × rows */
  h: Float32Array;
  cols: number;
  rows: number;
  /** 网格一格多少 CSS 像素 */
  cell: number;
  at: (x: number, y: number) => number;
}

/** 在 W×H 的画面上造一片海；岛避开罗经花所在的那一块（cx, cy, r） */
export function makeSea(W: number, H: number, rose: { x: number; y: number; r: number }): Sea {
  const cell = 8;
  const cols = Math.ceil(W / cell) + 1;
  const rows = Math.ceil(H / cell) + 1;
  const n = noise2(5);
  const islands = [
    { x: 0.83, y: 0.22, r: 0.16, h: 1.0 },
    { x: 0.95, y: 0.62, r: 0.13, h: 0.8 },
    { x: 0.66, y: 0.86, r: 0.1, h: 0.7 },
    { x: 0.12, y: 0.86, r: 0.12, h: 0.75 },
    { x: 0.06, y: 0.18, r: 0.1, h: 0.6 },
    { x: 0.52, y: 0.08, r: 0.06, h: 0.45 },
  ];
  const at = (x: number, y: number) => {
    const u = x / W;
    const v = y / H;
    const aspect = W / H;
    let e = -0.85;
    for (const s of islands) {
      const d2 = ((u - s.x) * aspect) ** 2 + (v - s.y) ** 2;
      e += s.h * 1.35 * Math.exp(-d2 / (2 * (s.r * 0.9) ** 2)) * 1.4;
    }
    e += 0.32 * n(u * 3.2 * aspect, v * 3.2) + 0.14 * n(u * 8 * aspect + 7, v * 8 + 3) + 0.05 * n(u * 20 * aspect, v * 20);
    // 罗经花底下是深水：把岛推开
    const dr = Math.hypot(x - rose.x, y - rose.y) / rose.r;
    if (dr < 1.25) e = Math.min(e, -0.9 + (dr / 1.25) * 0.5);
    return e;
  };
  const h = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) h[j * cols + i] = at(i * cell, j * cell);
  return { h, cols, rows, cell, at };
}

/** 某个高度的等值线：marching squares，返回一条 SVG path */
export function contour(sea: Sea, level: number): string {
  const { h, cols, rows, cell } = sea;
  let d = '';
  const f = (n: number) => n.toFixed(1);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = h[j * cols + i] - level;
      const b = h[j * cols + i + 1] - level;
      const c = h[(j + 1) * cols + i + 1] - level;
      const e = h[(j + 1) * cols + i] - level;
      const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (e > 0 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * cell;
      const y = j * cell;
      const top = [x + (cell * a) / (a - b), y];
      const right = [x + cell, y + (cell * b) / (b - c)];
      const bottom = [x + (cell * e) / (e - c), y + cell];
      const left = [x, y + (cell * a) / (a - e)];
      const seg = (p: number[], q: number[]) => (d += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`);
      switch (idx) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 5: seg(left, top); seg(bottom, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, top); break;
        case 10: seg(left, bottom); seg(top, right); break;
      }
    }
  }
  return d;
}

export const depthLevel = (m: number) => -m / SCALE;
export const depthAt = (sea: Sea, x: number, y: number) => Math.round(-sea.at(x, y) * SCALE);

/** 海岸上一串点（陆地边上、还在海里的那一格），给灯找位置 */
export function coastPoints(sea: Sea, W: number, H: number, margin: number): [number, number][] {
  const out: [number, number][] = [];
  const { h, cols, rows, cell } = sea;
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const v = h[j * cols + i];
      if (v > 0 && v < 0.12) {
        const near = [h[j * cols + i - 1], h[j * cols + i + 1], h[(j - 1) * cols + i], h[(j + 1) * cols + i]].some((u) => u < 0);
        const x = i * cell;
        const y = j * cell;
        if (near && x > margin && x < W - margin && y > margin && y < H - margin) out.push([x, y]);
      }
    }
  return out;
}

export { rng };

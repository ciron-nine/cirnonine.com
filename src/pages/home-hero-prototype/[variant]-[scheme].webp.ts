/**
 * PROTOTYPE：首页背景三个变体的静态后备。构建时用 math.ts 画出动画第一帧，浅色、深色各一张透明底 webp。
 * 没有 WebGL 时显示它；WebGL 第一帧画好后淡入盖住它。
 * 图片覆盖图形坐标 [-EXTENT, EXTENT]，页面上按 --unit 缩放（见 HomeBackdrop.astro）。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import {
  HOPF,
  hopfPoint,
  hopfView,
  SURFACE,
  surfacePoint,
  surfaceView,
  THOMAS,
  thomasB,
  thomasTrajectory,
  thomasView,
  view,
  type Vec3,
} from '../../components/home-hero-prototype/math';

export const EXTENT = 1.6;
// 背景上的静态图会被放大，800 像素够用；再大的话 Hopf 那张线很密，体积涨得很快
const SIZE = 800;
const INK = { light: '#161616', dark: '#e9e7e2' } as const;

export const getStaticPaths = (() =>
  ['hopf', 'flow', 'surface'].flatMap((variant) =>
    ['light', 'dark'].map((scheme) => ({ params: { variant, scheme } })),
  )) satisfies GetStaticPaths;

const px = (v: number) => ((v / EXTENT + 1) * SIZE) / 2;

/** 一条折线：点已经是屏幕坐标，按平均深度给透明度 */
function polyline(points: [number, number, number][], opacity: number): string {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${(SIZE - px(y)).toFixed(1)}`).join('');
  return `<path d="${d}" stroke-opacity="${opacity.toFixed(3)}"/>`;
}

function hopfPaths(): string[] {
  const { yaw, tilt } = hopfView(0);
  const paths: string[] = [];
  for (let r = 0; r < HOPF.rings; r++) {
    // 每三根画一根：线密的地方压缩率很差，全画的话一张要 100–150 KB
    for (let f = 0; f < HOPF.fibers; f += 3) {
      const phi = ((f + (r % 2) * 0.5) / HOPF.fibers) * Math.PI * 2;
      const pts: { p: [number, number, number]; a: number }[] = [];
      for (let s = 0; s <= 96; s++) {
        const { p, alpha } = hopfPoint(r / (HOPF.rings - 1), phi, (s / 96) * Math.PI * 2, 0);
        pts.push({ p: view(p, yaw, tilt, HOPF.dist), a: alpha });
      }
      // 每 8 段一截，各按自己的透明度画：飞到远处的那一截淡掉，不会拉出一条横穿画面的直线
      for (let s = 0; s < 96; s += 8) {
        const chunk = pts.slice(s, s + 9);
        const a = chunk.reduce((sum, c) => sum + c.a, 0) / chunk.length;
        if (a < 0.35) continue;
        const depth = chunk.reduce((sum, c) => sum + c.p[2], 0) / chunk.length;
        paths.push(polyline(chunk.map((c) => c.p), a * (0.1 + 0.3 * Math.min(Math.max(depth * 0.4 + 0.5, 0), 1))));
      }
    }
  }
  return paths;
}

function flowPaths(): string[] {
  const { yaw, tilt } = thomasView(0);
  const paths: string[] = [];
  // 很多条从不同地方出发的短轨迹，比一条长轨迹更像粒子流；起点用固定的伪随机，每次构建一样
  let seed = 9;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 9;
  for (let k = 0; k < 140; k++) {
    const traj = thomasTrajectory(700, thomasB(0), 0.06, [rand(), rand(), rand()]);
    for (let i = 0; i < traj.length - 1; i += 70) {
      const pts = traj.slice(i, i + 71).map((p) => view(p, yaw, tilt, THOMAS.dist));
      const depth = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
      paths.push(polyline(pts, 0.08 + 0.14 * Math.min(Math.max(depth * 0.5 + 0.5, 0), 1)));
    }
  }
  return paths;
}

function surfacePaths(): string[] {
  const { yaw, tilt } = surfaceView(0);
  const paths: string[] = [];
  const lines = 40;
  for (let l = 0; l < lines; l++) {
    const fixed = l / lines;
    for (const along of ['u', 'v'] as const) {
      const pts: [number, number, number][] = [];
      for (let s = 0; s <= 120; s++) {
        const t = s / 120;
        const p: Vec3 = along === 'u' ? surfacePoint(t, fixed, 0) : surfacePoint(fixed, t, 0);
        pts.push(view(p, yaw, tilt, SURFACE.dist));
      }
      const depth = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
      paths.push(polyline(pts, 0.12 + 0.3 * Math.min(Math.max(depth * 0.5 + 0.5, 0), 1)));
    }
  }
  return paths;
}

const DRAW = { hopf: hopfPaths, flow: flowPaths, surface: surfacePaths } as const;

export const GET: APIRoute = async ({ params }) => {
  const ink = INK[params.scheme as keyof typeof INK];
  const paths = DRAW[params.variant as keyof typeof DRAW]();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><g fill="none" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round">${paths.join('')}</g></svg>`;
  const webp = await sharp(Buffer.from(svg)).webp({ quality: 50, alphaQuality: 30 }).toBuffer();
  return new Response(new Uint8Array(webp), { headers: { 'Content-Type': 'image/webp' } });
};

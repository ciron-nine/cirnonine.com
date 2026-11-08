/**
 * PROTOTYPE 变体 A 的静态后备：构建时把 Aizawa 吸引子画成一张透明底的 webp，浅色、深色各一张。
 * 没有 WebGL 时显示它；WebGL 第一帧和它是同一个角度，淡入时不跳。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { aizawaPoints, project, FIT, START_ANGLE } from '../../components/home-hero-prototype/aizawa';

const INK = { light: '#161616', dark: '#e9e7e2' } as const;
const SIZE = 900;
// 点数和压缩参数按体积定：一张约 50 KB，首屏不拖慢；线比 WebGL 版稀，像速写
const POINTS = 30_000;
const CHUNK = 120;

export const getStaticPaths = (() => [{ params: { scheme: 'light' } }, { params: { scheme: 'dark' } }]) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const ink = INK[params.scheme as keyof typeof INK];
  const pts = aizawaPoints(POINTS);
  const half = SIZE / 2;
  const scale = half * FIT;
  const paths: string[] = [];
  for (let start = 0; start < POINTS - 1; start += CHUNK) {
    const end = Math.min(start + CHUNK + 1, POINTS);
    let d = '';
    let depth = 0;
    for (let i = start; i < end; i++) {
      const [sx, sy, sz] = project(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], START_ANGLE);
      d += `${i === start ? 'M' : 'L'}${(half + sx * scale).toFixed(1)} ${(half - sy * scale).toFixed(1)}`;
      depth += sz;
    }
    depth /= end - start;
    // 近处的线更实，远处的淡
    const opacity = (0.08 + 0.2 * (depth * 0.5 + 0.5)).toFixed(3);
    paths.push(`<path d="${d}" stroke-opacity="${opacity}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><g fill="none" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round">${paths.join('')}</g></svg>`;
  const webp = await sharp(Buffer.from(svg)).webp({ quality: 50, alphaQuality: 30 }).toBuffer();
  return new Response(new Uint8Array(webp), { headers: { 'Content-Type': 'image/webp' } });
};

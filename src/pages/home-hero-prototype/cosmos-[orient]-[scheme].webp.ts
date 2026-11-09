/**
 * PROTOTYPE（第三轮）：宇宙背景的静态后备，构建时画出第一屏的远景（镜头在 CAMERA[0]）。
 * 横屏、竖屏各一张，浅色、深色各一张。先在黑底上画「亮度」，再按亮度在纸色和墨色之间插值，和 WebGL 版一个画法。
 * 没有 WebGL 时一直显示它；有 WebGL 时它是首屏，WebGL 第一帧画好后淡入盖住它。
 * 行星在这里是一个带渐变的圆加两道椭圆环，比 WebGL 版简单。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import {
  CAMERA,
  figureEight,
  galaxyParticles,
  galaxyToWorld,
  NEBULA,
  PLANET,
  project,
  starfield,
  threeBodyToWorld,
  type Vec3,
} from '../../components/home-hero-prototype/cosmos-math';

const SIZES = { wide: [1280, 800], tall: [720, 1280] } as const;
/** 和 Shell.astro 的 --shell-bg / --shell-fg 一致 */
const COLORS = {
  light: { paper: [0xf7, 0xf6, 0xf2], ink: [0x16, 0x16, 0x16] },
  dark: { paper: [0x13, 0x13, 0x12], ink: [0xe9, 0xe7, 0xe2] },
} as const;
const FOV = (50 * Math.PI) / 180;

export const getStaticPaths = (() =>
  ['wide', 'tall'].flatMap((orient) => ['light', 'dark'].map((scheme) => ({ params: { orient, scheme } })))) satisfies GetStaticPaths;

function svgFor(w: number, h: number): string {
  const aspect = w / h;
  // 竖屏时镜头往后退，和 gl-cosmos.ts 一样
  const back = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
  const cam = {
    target: CAMERA[0].target,
    pos: CAMERA[0].pos.map((v, c) => CAMERA[0].target[c] + (v - CAMERA[0].target[c]) * back) as Vec3,
  };
  const toPx = (p: Vec3) => {
    const q = project(p, cam, FOV, aspect);
    return q && { x: ((q[0] + 1) / 2) * w, y: ((1 - q[1]) / 2) * h, z: q[2] };
  };
  const parts: string[] = [];

  // 星云：几团模糊的光
  for (const [dx, dy, s] of [
    [0, 0, 1],
    [-4, 2, 0.7],
    [5, -1.5, 0.65],
    [2, 3, 0.8],
  ]) {
    const c = toPx([NEBULA.center[0] + dx, NEBULA.center[1] + dy, NEBULA.center[2]]);
    if (!c) continue;
    const r = ((NEBULA.size * s) / c.z) * (h / 2) / Math.tan(FOV / 2);
    parts.push(`<ellipse cx="${c.x}" cy="${c.y}" rx="${r * 0.7}" ry="${r * 0.45}" fill="#fff" opacity="0.13" filter="url(#blur)"/>`);
  }

  // 背景星
  const stars = starfield(1600);
  for (let i = 0; i < stars.length / 4; i++) {
    const p = toPx([stars[i * 4], stars[i * 4 + 1], stars[i * 4 + 2]]);
    if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    const m = stars[i * 4 + 3];
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(0.5 + m * 1.2).toFixed(2)}" fill="#fff" opacity="${(0.3 + m * 0.7).toFixed(2)}"/>`);
  }

  // 星系
  const g = galaxyParticles(9000, []);
  for (let i = 0; i < g.length / 5; i++) {
    const p = toPx(galaxyToWorld(g[i * 5], g[i * 5 + 1], g[i * 5 + 2]));
    if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="0.7" fill="#fff" opacity="${(g[i * 5 + 3] * 0.6).toFixed(2)}"/>`);
  }

  // 三体 8 字形轨道
  const curve = figureEight(240)
    .map(([x, y]) => toPx(threeBodyToWorld(x, y)))
    .filter((p): p is NonNullable<typeof p> => !!p);
  parts.push(`<path d="${curve.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')}Z" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.5"/>`);

  // 行星：带渐变的球，加一道光环
  const c = toPx(PLANET.center);
  if (c) {
    const r = (PLANET.radius / c.z) * (h / 2) / Math.tan(FOV / 2);
    const ring = (k: number, op: number) =>
      `<ellipse cx="${c.x}" cy="${c.y}" rx="${r * k}" ry="${r * k * 0.28}" transform="rotate(-18 ${c.x} ${c.y})" fill="none" stroke="#fff" stroke-width="${r * 0.32}" opacity="${op}"/>`;
    parts.push(ring(1.85, 0.32));
    parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="url(#lit)"/>`);
    // 前半圈的环压在球上
    parts.push(`<path d="M${c.x - r * 1.85} ${c.y} A${r * 1.85} ${r * 1.85 * 0.28} 0 0 0 ${c.x + r * 1.85} ${c.y}" transform="rotate(-18 ${c.x} ${c.y})" fill="none" stroke="#fff" stroke-width="${r * 0.32}" opacity="0.36"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${h / 18}"/></filter>
      <radialGradient id="lit" cx="0.7" cy="0.35" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.15"/><stop offset="1" stop-color="#000"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#000"/>
    ${parts.join('')}
  </svg>`;
}

export const GET: APIRoute = async ({ params }) => {
  const [w, h] = SIZES[params.orient as keyof typeof SIZES];
  const { paper, ink } = COLORS[params.scheme as keyof typeof COLORS];
  // 亮度 l（0..1）映射成 paper + (ink - paper) * l，三个通道各一条直线
  const gray = await sharp(Buffer.from(svgFor(w, h))).greyscale().extractChannel(0).raw().toBuffer();
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const l = gray[i] / 255;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(paper[c] + (ink[c] - paper[c]) * l);
  }
  const out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 62 }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/webp' } });
};

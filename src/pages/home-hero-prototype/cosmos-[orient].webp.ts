/**
 * PROTOTYPE（第四轮）：宇宙背景的静态后备，构建时画出第一屏的星空（镜头在 CAMERA[0]）。
 * 横屏、竖屏各一张；首页固定是夜里，所以只有深色一种。
 * 没有 WebGL 时一直显示它；有 WebGL 时它是首屏，WebGL 第一帧画好后淡入盖住它。
 * 银河在这里是几道模糊的粗线，比 WebGL 版简单。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import {
  BAND_CENTER,
  BAND_NORMAL,
  basis,
  CAMERA,
  NEBULA,
  PLANET,
  project,
  starfield,
  STAR_STRIDE,
  type Vec3,
} from '../../components/home-hero-prototype/cosmos-math';

const SIZES = { wide: [1280, 800], tall: [720, 1280] } as const;
const FOV = (50 * Math.PI) / 180;
const rgb = ([r, g, b]: Vec3) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

export const getStaticPaths = (() => ['wide', 'tall'].map((orient) => ({ params: { orient } }))) satisfies GetStaticPaths;

function svgFor(w: number, h: number): string {
  const aspect = w / h;
  const back = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
  const cam = {
    target: CAMERA[0].target,
    pos: CAMERA[0].pos.map((v, c) => CAMERA[0].target[c] + (v - CAMERA[0].target[c]) * back) as Vec3,
  };
  const at = (d: Vec3, r = 500): Vec3 => [cam.pos[0] + d[0] * r, cam.pos[1] + d[1] * r, cam.pos[2] + d[2] * r];
  const toPx = (p: Vec3) => {
    const q = project(p, cam, FOV, aspect);
    return q && { x: ((q[0] + 1) / 2) * w, y: ((1 - q[1]) / 2) * h, z: q[2] };
  };
  const parts: string[] = [];

  // 银河：沿大圆取一串点投影到屏幕上，连成几道粗细不同的模糊线
  const [e1, e2] = basis(BAND_NORMAL);
  const band: { x: number; y: number }[] = [];
  for (let i = 0; i <= 720; i++) {
    const th = (i / 720) * Math.PI * 2;
    const p = toPx(at([0, 1, 2].map((c) => e1[c] * Math.cos(th) + e2[c] * Math.sin(th)) as Vec3));
    if (p && p.x > -w && p.x < 2 * w && p.y > -h && p.y < 2 * h) band.push(p);
  }
  if (band.length > 1) {
    band.sort((a, b) => a.x - b.x);
    const d = band.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    parts.push(`<path d="${d}" fill="none" stroke="#7c8fd0" stroke-width="${h * 0.42}" opacity="0.18" filter="url(#wide)"/>`);
    parts.push(`<path d="${d}" fill="none" stroke="#aab8ea" stroke-width="${h * 0.16}" opacity="0.28" filter="url(#soft)"/>`);
    parts.push(`<path d="${d}" fill="none" stroke="#040611" stroke-width="${h * 0.025}" opacity="0.55" filter="url(#thin)"/>`);
    const core = toPx(at(BAND_CENTER));
    if (core) parts.push(`<ellipse cx="${core.x}" cy="${core.y}" rx="${h * 0.35}" ry="${h * 0.18}" fill="#f2c46d" opacity="0.22" filter="url(#wide)"/>`);
  }

  // 星云：青和玫红的两团
  for (const [dx, dy, s, color] of [
    [0, 0, 1, '#4cc3c9'],
    [-4, 2, 0.7, '#e46a7c'],
    [5, -1.5, 0.65, '#e46a7c'],
    [2, 3, 0.8, '#4cc3c9'],
  ] as const) {
    const c = toPx([NEBULA.center[0] + dx, NEBULA.center[1] + dy, NEBULA.center[2]]);
    if (!c) continue;
    const r = (((NEBULA.size * s) / c.z) * (h / 2)) / Math.tan(FOV / 2);
    parts.push(`<ellipse cx="${c.x}" cy="${c.y}" rx="${r * 0.7}" ry="${r * 0.45}" fill="${color}" opacity="0.16" filter="url(#soft)"/>`);
  }

  // 恒星：按光谱型的颜色
  const stars = starfield(3200);
  for (let i = 0; i < stars.length / STAR_STRIDE; i++) {
    const o = i * STAR_STRIDE;
    const p = toPx([stars[o], stars[o + 1], stars[o + 2]]);
    if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    const m = stars[o + 3];
    const color = rgb([stars[o + 4], stars[o + 5], stars[o + 6]]);
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(0.45 + m * 1.4).toFixed(2)}" fill="${color}" opacity="${(0.25 + m * 0.75).toFixed(2)}"/>`);
  }

  // 行星：赭色的球，加一道暖灰的环
  const c = toPx(PLANET.center);
  if (c) {
    const r = ((PLANET.radius / c.z) * (h / 2)) / Math.tan(FOV / 2);
    const ring = (op: number, front: boolean) =>
      front
        ? `<path d="M${c.x - r * 1.85} ${c.y} A${r * 1.85} ${r * 1.85 * 0.28} 0 0 0 ${c.x + r * 1.85} ${c.y}" transform="rotate(-18 ${c.x} ${c.y})" fill="none" stroke="#cbbd9e" stroke-width="${r * 0.32}" opacity="${op}"/>`
        : `<ellipse cx="${c.x}" cy="${c.y}" rx="${r * 1.85}" ry="${r * 1.85 * 0.28}" transform="rotate(-18 ${c.x} ${c.y})" fill="none" stroke="#cbbd9e" stroke-width="${r * 0.32}" opacity="${op}"/>`;
    parts.push(ring(0.4, false));
    parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="url(#lit)"/>`);
    parts.push(ring(0.5, true));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <filter id="wide" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${h / 10}"/></filter>
      <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${h / 30}"/></filter>
      <filter id="thin" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${h / 160}"/></filter>
      <radialGradient id="lit" cx="0.7" cy="0.35" r="0.9"><stop offset="0" stop-color="#ead9b4"/><stop offset="0.45" stop-color="#c9955c"/><stop offset="0.8" stop-color="#5a3322"/><stop offset="1" stop-color="#040611"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#040611"/>
    ${parts.join('')}
  </svg>`;
}

export const GET: APIRoute = async ({ params }) => {
  const [w, h] = SIZES[params.orient as keyof typeof SIZES];
  const out = await sharp(Buffer.from(svgFor(w, h))).webp({ quality: 64 }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/webp' } });
};

/**
 * PROTOTYPE 变体 C：夜空、缓慢流动的极光，偶尔一颗流星。
 * 极光的颜色来自记录封面的主色（palette.ts），每次来随机挑几条记录的颜色。
 * 全屏一个三角形，片元着色器里画天空、星、三层极光帘和流星；按较低的分辨率渲染再拉伸，极光本来就是软的。
 */
import { Mesh, Program, Triangle } from 'ogl';
import { glow, pickPalette, type PaletteSource } from './palette';
import { createRenderer, startLoop, type Mounted, type MountOptions } from './gl-common';

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  uniform vec2 uMeteorA;
  uniform vec2 uMeteorB;
  uniform float uMeteor;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
  vec3 palette(float t) {
    t = fract(t) * 4.0;
    if (t < 1.0) return mix(uC0, uC1, smoothstep(0.0, 1.0, t));
    if (t < 2.0) return mix(uC1, uC2, smoothstep(1.0, 2.0, t));
    if (t < 3.0) return mix(uC2, uC3, smoothstep(2.0, 3.0, t));
    return mix(uC3, uC0, smoothstep(3.0, 4.0, t));
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    // 天空：不带颜色倾向的深灰黑，靠近地平线稍亮
    vec3 col = mix(vec3(0.045, 0.047, 0.055), vec3(0.008, 0.009, 0.012), smoothstep(0.0, 0.9, uv.y));

    // 星：网格里随机点亮少数格子，按 CSS 像素算格子大小，手机和桌面一样密
    vec2 sp = gl_FragCoord.xy / uRes.y * 260.0;
    vec2 cell = floor(sp);
    float h = hash(cell);
    if (h > 0.982) {
      vec2 f = fract(sp) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
      float tw = 0.55 + 0.45 * sin(uTime * (0.7 + h * 3.0) + h * 90.0);
      col += vec3(0.75) * smoothstep(0.22, 0.0, length(f)) * tw * smoothstep(0.05, 0.4, uv.y);
    }

    // 极光：三层帘子，下沿清楚、往上慢慢淡掉，帘上有竖直的光柱
    vec3 aurora = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float x = p.x * (0.55 + fi * 0.12) + fi * 3.7;
      float base = 0.42 + fi * 0.09 + 0.22 * (fbm(vec2(x * 0.9, uTime * 0.025 + fi * 5.0)) - 0.5);
      float dy = uv.y - base;
      float band = dy > 0.0 ? exp(-dy * (4.5 - fi)) : exp(-dy * dy * 700.0);
      float rays = 0.35 + 0.65 * fbm(vec2(x * 14.0 + fbm(vec2(x * 2.0, uTime * 0.05)) * 2.0, uTime * 0.08 + fi * 9.0));
      float veil = smoothstep(0.25, 0.75, fbm(vec2(x * 1.4 - uTime * 0.03, fi * 2.3 + uTime * 0.01)));
      vec3 c = palette(fbm(vec2(x * 0.5 + uTime * 0.012, fi * 4.0)) * 1.6 + fi * 0.27 + dy * 0.8);
      aurora += c * band * rays * veil * (0.8 - fi * 0.15);
    }
    col += aurora;

    // 流星：从 A 划到 B，拖一条渐淡的尾巴
    if (uMeteor > 0.0 && uMeteor < 1.0) {
      vec2 a = uMeteorA * vec2(aspect, 1.0);
      vec2 b = uMeteorB * vec2(aspect, 1.0);
      vec2 dir = normalize(b - a);
      vec2 head = mix(a, b, uMeteor);
      float tail = 0.22;
      vec2 q = p - head;
      float along = dot(q, -dir);
      float across = abs(dot(q, vec2(-dir.y, dir.x)));
      float fade = sin(uMeteor * 3.14159);
      if (along > 0.0 && along < tail) {
        float w = mix(0.0016, 0.0003, along / tail);
        col += vec3(0.95) * smoothstep(w, 0.0, across) * (1.0 - along / tail) * fade;
      }
      col += vec3(0.9) * exp(-dot(q, q) * 60000.0) * fade;
    }

    // 胶片颗粒
    col += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 100.0) - 0.5) * 0.025;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export function mount({ frame, canvas, still }: MountOptions): Mounted | null {
  // 渲染的像素宽度压在约 900 以内：极光是软的，降分辨率看不出来，手机上省电
  const cssWidth = frame.getBoundingClientRect().width || 800;
  const dpr = Math.min(devicePixelRatio, 900 / cssWidth);
  const renderer = createRenderer(canvas, { dpr, alpha: false });
  if (!renderer) return null;
  const { gl } = renderer;

  const sources: PaletteSource[] = JSON.parse(frame.dataset.palette ?? '[]');
  const colors = pickPalette(sources, Math.random).map(glow);
  while (colors.length < 4) colors.push(colors[colors.length % Math.max(colors.length, 1)] ?? [0.6, 0.6, 0.6]);
  // 只有一种颜色时，四个槽位都一样：极光就是这一种颜色的明暗

  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uC0: { value: colors[0] },
    uC1: { value: colors[1] },
    uC2: { value: colors[2] },
    uC3: { value: colors[3] },
    uMeteorA: { value: [0, 0] },
    uMeteorB: { value: [0, 0] },
    uMeteor: { value: -1 },
  };
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex, fragment, uniforms }) });

  // 流星：每隔 8–20 秒一颗，0.9 秒划过
  let nextMeteor = 4 + Math.random() * 6;
  let meteorStart = -1;
  const METEOR_DURATION = 0.9;

  const loop = startLoop({
    frame,
    renderer,
    still,
    stillTime: 40,
    resize(w, h) {
      uniforms.uRes.value = [w * renderer.dpr, h * renderer.dpr];
    },
    draw(t) {
      uniforms.uTime.value = t;
      if (!still) {
        if (meteorStart < 0 && t > nextMeteor) {
          meteorStart = t;
          const fromLeft = Math.random() < 0.5;
          const ax = fromLeft ? 0.1 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4;
          const ay = 0.75 + Math.random() * 0.2;
          const len = 0.25 + Math.random() * 0.15;
          uniforms.uMeteorA.value = [ax, ay];
          uniforms.uMeteorB.value = [ax + (fromLeft ? len : -len), ay - len * 0.55];
        }
        if (meteorStart >= 0) {
          const k = (t - meteorStart) / METEOR_DURATION;
          uniforms.uMeteor.value = k;
          if (k >= 1) {
            meteorStart = -1;
            uniforms.uMeteor.value = -1;
            nextMeteor = t + 8 + Math.random() * 12;
          }
        }
      }
      renderer.render({ scene: mesh });
    },
  });
  return loop;
}

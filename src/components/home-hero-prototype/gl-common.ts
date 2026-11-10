/**
 * PROTOTYPE：宇宙背景的渲染循环和小工具。只在 cosmos.ts 判断要上 WebGL 之后才按需加载（连同 OGL）。
 *
 * - 切到别的标签页时停帧
 * - still：减少动态效果时只画一帧，之后只在尺寸或配色变化时重画（不跟着滚动动）
 * - 渲染分辨率按像素总数封顶，全屏背景在高分屏和手机上不至于太费 GPU
 * - 拿不到 WebGL 上下文时返回 null，页面保持静态后备
 */
import { Renderer } from 'ogl';
import type { Pulse } from './pulse';

export interface MountOptions {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  still: boolean;
  pulse: Pulse;
  /** 每条记录在星系里的位置和亮度 */
  records: { arm: number; along: number; mag: number }[];
  /** 小册子翻到哪儿了：0 合着（星空），1 翻开第一页（行星），2 翻到第二页（星系） */
  progress(): number;
  /** 每帧把音乐强弱交出去，小册子的纸用它一起呼吸 */
  onPulse(level: number): void;
}

export interface Mounted {
  destroy(): void;
}

export interface FrameState {
  time: number;
  dt: number;
  pulse: number;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  frame: HTMLElement,
  opts: { maxPixels: number; maxDpr?: number },
): Renderer | null {
  const { width, height } = frame.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, opts.maxDpr ?? 2, Math.sqrt(opts.maxPixels / Math.max(width * height, 1)));
  try {
    const renderer = new Renderer({ canvas, dpr, alpha: false, antialias: false, premultipliedAlpha: false });
    return renderer.gl ? renderer : null;
  } catch {
    return null;
  }
}

function parseColor(value: string): [number, number, number] {
  const m = value.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

/** 外壳的墨色和纸色（随浅色 / 深色变化），0..1 的 RGB */
export function readColors(el: HTMLElement): { ink: [number, number, number]; paper: [number, number, number] } {
  const style = getComputedStyle(el);
  return { ink: parseColor(style.color), paper: parseColor(style.backgroundColor) };
}

interface LoopOptions {
  frame: HTMLElement;
  renderer: Renderer;
  still: boolean;
  pulse: Pulse;
  stillTime?: number;
  draw(state: FrameState): void;
  resize?(width: number, height: number): void;
  scheme?(): void;
  onPulse?(level: number): void;
}

export function startLoop(o: LoopOptions): { destroy(): void; redraw(): void } {
  let raf = 0;
  let destroyed = false;
  let time = o.stillTime ?? 0;
  let last = performance.now();
  let pulse = 0;

  const redraw = () => {
    if (!destroyed) o.draw({ time, dt: 0, pulse });
  };

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    // 音乐强弱做一点平滑：起得快、落得慢，像呼吸
    const target = o.pulse.level();
    pulse += (target - pulse) * (target > pulse ? 0.5 : 0.08);
    o.onPulse?.(pulse);
    o.draw({ time, dt, pulse });
    schedule();
  };

  const schedule = () => {
    if (destroyed || o.still || raf || document.hidden) return;
    raf = requestAnimationFrame(tick);
  };

  const resize = () => {
    const { width, height } = o.frame.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    o.renderer.setSize(width, height);
    o.resize?.(width, height);
    redraw();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(o.frame);
  const onVisibility = () => {
    last = performance.now();
    schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => {
    o.scheme?.();
    redraw();
  };
  dark.addEventListener('change', onScheme);

  resize();
  schedule();

  return {
    redraw,
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      dark.removeEventListener('change', onScheme);
      o.onPulse?.(0);
      o.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** 着色器里共用的哈希和噪声 */
export const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
`;

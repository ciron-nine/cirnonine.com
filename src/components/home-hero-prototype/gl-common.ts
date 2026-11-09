/**
 * PROTOTYPE：三个背景变体共用的渲染循环。只在 backdrop.ts 判断要上 WebGL 之后才按需加载（连同 OGL）。
 *
 * - 背景铺满视口、钉在内容后面。第一屏最浓；往下滚，动画放慢、颜色变淡，滚过一屏半以后降到四分之一帧率
 * - 切到别的标签页时停帧
 * - still：减少动态效果时只画一帧，之后只在尺寸或配色变化时重画
 * - 渲染分辨率按像素总数封顶，全屏背景在高分屏和手机上不至于太费 GPU
 * - 拿不到 WebGL 上下文时返回 null，页面保持静态后备
 */
import { Renderer } from 'ogl';
import type { Pulse } from './pulse';

export interface MountOptions {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  still: boolean;
  /** 跟着背景音乐的强弱，0..1；没有音乐数据时一直是 0 */
  pulse: Pulse;
  /** 每条记录的亮度（心头好更亮），给想用记录做数据层的变体 */
  records: number[];
}

export interface Mounted {
  destroy(): void;
}

/** 每帧传给变体的状态 */
export interface FrameState {
  /** 动画时间（秒）：往下滚时走得慢 */
  time: number;
  /** 这一帧走过的动画时间 */
  dt: number;
  /** 浓度 1..0.3：第一屏是 1，往下滚变淡 */
  strength: number;
  /** 音乐强弱 0..1 */
  pulse: number;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  frame: HTMLElement,
  opts: { maxPixels: number; maxDpr?: number },
): Renderer | null {
  try {
    const renderer = new Renderer({
      canvas,
      dpr: renderDpr(frame, opts),
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    return renderer.gl ? renderer : null;
  } catch {
    return null;
  }
}

function renderDpr(frame: HTMLElement, { maxPixels, maxDpr = 2 }: { maxPixels: number; maxDpr?: number }) {
  const { width, height } = frame.getBoundingClientRect();
  const area = Math.max(width * height, 1);
  return Math.min(devicePixelRatio, maxDpr, Math.sqrt(maxPixels / area));
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

/** 页面滚过了几屏 */
function screensScrolled() {
  return scrollY / Math.max(innerHeight, 1);
}

interface LoopOptions {
  frame: HTMLElement;
  renderer: Renderer;
  still: boolean;
  pulse: Pulse;
  /** 减少动态效果时画的那一帧的时间（秒） */
  stillTime?: number;
  draw(state: FrameState): void;
  resize?(width: number, height: number): void;
  /** 配色（浅 / 深）变了 */
  scheme?(): void;
}

export function startLoop(o: LoopOptions): { destroy(): void; redraw(): void } {
  let raf = 0;
  let destroyed = false;
  let time = o.stillTime ?? 0;
  let last = performance.now();
  let skipped = 0;
  let pulse = 0;

  const strengthNow = () => {
    // 第一屏是 1，滚到一屏多时降到 0.3
    const s = Math.min(Math.max(screensScrolled() - 0.15, 0) / 1.1, 1);
    return 1 - 0.7 * s * s * (3 - 2 * s);
  };

  const redraw = () => {
    if (!destroyed) o.draw({ time, dt: 0, strength: strengthNow(), pulse: 0 });
  };

  const tick = (now: number) => {
    raf = 0;
    const strength = strengthNow();
    // 滚过一屏半：已经很淡，四帧画一帧
    if (strength < 0.32 && ++skipped % 4 !== 0) {
      schedule();
      return;
    }
    // 停过帧之后不把停掉的时间算进去，动画从停下的地方接着走
    const real = Math.min((now - last) / 1000, 0.1);
    last = now;
    // 越往下滚动画越慢：浓度 1 时原速，0.3 时约四分之一
    const dt = real * (0.25 + 0.75 * ((strength - 0.3) / 0.7));
    time += dt;
    // 音乐强弱做一点平滑：起得快、落得慢，像呼吸
    const target = o.pulse.level();
    pulse += (target - pulse) * (target > pulse ? 0.5 : 0.08);
    o.draw({ time, dt, strength, pulse });
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
  // 减少动态效果时没有动画循环，滚动时要自己重画，浓度才会跟着变
  const onScroll = () => {
    if (o.still) redraw();
  };
  addEventListener('scroll', onScroll, { passive: true });

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
      removeEventListener('scroll', onScroll);
      o.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** 三个变体共用的 GLSL 片段：哈希、胶片颗粒 */
export const GLSL_HASH = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

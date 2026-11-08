/**
 * PROTOTYPE：三个 WebGL 变体共用的渲染循环。只在 hero.ts 判断要上 WebGL 之后才按需加载（连同 OGL）。
 *
 * - 看不见（滚出视口、切到别的标签页）时停帧
 * - still：减少动态效果时只画一帧，之后只在尺寸或配色变化时重画
 * - 拿不到 WebGL 上下文时返回 null，页面保持静态后备
 */
import { Renderer } from 'ogl';

export interface MountOptions {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  still: boolean;
}

export interface Mounted {
  destroy(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, opts: { dpr: number; alpha: boolean }): Renderer | null {
  try {
    const renderer = new Renderer({ canvas, dpr: opts.dpr, alpha: opts.alpha, antialias: false, premultipliedAlpha: false });
    return renderer.gl ? renderer : null;
  } catch {
    return null;
  }
}

/** 读当前的墨色（外壳的前景色，随浅色 / 深色变化），返回 0..1 的 RGB */
export function readInk(el: HTMLElement): [number, number, number] {
  const m = getComputedStyle(el).color.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

interface LoopOptions {
  frame: HTMLElement;
  renderer: Renderer;
  still: boolean;
  /** 减少动态效果时画的那一帧的时间（秒） */
  stillTime?: number;
  draw(time: number): void;
  resize?(width: number, height: number): void;
  /** 配色（浅 / 深）变了 */
  scheme?(): void;
}

export function startLoop(o: LoopOptions): { destroy(): void; redraw(): void } {
  let raf = 0;
  let inView = true;
  let destroyed = false;
  let elapsed = 0;
  let last = performance.now();

  const redraw = () => {
    if (!destroyed) o.draw(o.still ? (o.stillTime ?? 0) : elapsed);
  };

  const tick = (now: number) => {
    raf = 0;
    // 停过帧之后不把停掉的时间算进去，动画从停下的地方接着走
    elapsed += Math.min((now - last) / 1000, 0.1);
    last = now;
    o.draw(elapsed);
    schedule();
  };

  const schedule = () => {
    if (destroyed || o.still || raf || !inView || document.hidden) return;
    last = performance.now();
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
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  });
  io.observe(o.frame);
  const onVisibility = () => schedule();
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
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      dark.removeEventListener('change', onScheme);
      o.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

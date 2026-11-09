/**
 * PROTOTYPE：首页全屏背景的控制器。这个文件很小，跟着首页一起加载；OGL 和各变体的 WebGL 代码按需加载：
 * 浏览器空闲之后才 import()，首屏只有静态后备（一张透明底 webp）。
 *
 * - 没有 WebGL（或者 ?gl=0）：停在静态后备
 * - prefers-reduced-motion：WebGL 只画一帧，不动
 */
import type { Mounted, MountOptions } from './gl-common';
import { createPulse, type Pulse } from './pulse';

type Mount = (o: MountOptions) => Mounted | null;

const loaders: Record<string, () => Promise<{ mount: Mount }>> = {
  hopf: () => import('./gl-hopf'),
  flow: () => import('./gl-flow'),
  surface: () => import('./gl-surface'),
};

let mounted: Mounted | null = null;
let generation = 0;
let pulse: Pulse | undefined;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function stop() {
  generation++;
  mounted?.destroy();
  mounted = null;
  for (const frame of document.querySelectorAll<HTMLElement>('[data-hero-frame]')) {
    frame.dataset.gl = 'off';
    frame.querySelector('canvas')?.remove();
  }
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 1200 });
    else setTimeout(resolve, 200);
  });
}

/** 填上当前变体静态图的地址（原型里三张图只下载当前这张） */
function showStill(frame: HTMLElement) {
  for (const source of frame.querySelectorAll<HTMLSourceElement>('source[data-srcset]')) source.srcset = source.dataset.srcset!;
  for (const img of frame.querySelectorAll<HTMLImageElement>('img[data-src]')) img.src = img.dataset.src!;
}

/** 浏览器能不能开 WebGL：用一个丢弃的 canvas 试一下 */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

async function start() {
  stop();
  const root = document.querySelector<HTMLElement>('[data-backdrop]');
  if (!root) return;
  const frame = [...root.querySelectorAll<HTMLElement>('[data-hero-frame]')].find(
    (f) => !f.closest('[data-variant][hidden]'),
  );
  const variant = frame?.dataset.glVariant;
  if (!frame || !variant || !loaders[variant]) return;
  showStill(frame);

  const params = new URL(location.href).searchParams;
  if (params.get('gl') === '0' || !webglAvailable()) return;

  const mine = ++generation;
  await idle();
  const { mount } = await loaders[variant]();
  if (mine !== generation) return;

  const records: number[] = JSON.parse(
    (params.get('sample') === '1' ? root.dataset.recordsSample : root.dataset.records) ?? '[]',
  );
  pulse ??= createPulse();
  const canvas = document.createElement('canvas');
  frame.append(canvas);
  mounted = mount({ frame, canvas, still: reduced.matches, pulse, records });
  if (!mounted) {
    canvas.remove();
    return;
  }
  // 第一帧画好再淡入，盖住静态后备
  requestAnimationFrame(() => {
    if (mine === generation) frame.dataset.gl = 'on';
  });
}

// 首页在 astro:page-load 时调 showCurrentVariant()，它会发出 prototype:variant，所以这里只听这一个
document.addEventListener('prototype:variant', start);
document.addEventListener('astro:before-swap', stop);
reduced.addEventListener('change', start);

/** 调试用：现在背景跟着什么在动（audio / demo / none） */
(window as unknown as { backdropPulse?: () => string }).backdropPulse = () => pulse?.source() ?? 'none';

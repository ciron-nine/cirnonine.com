/**
 * PROTOTYPE：首页主视觉的控制器。这个文件很小，跟着首页一起加载；OGL 和各变体的 WebGL 代码按需加载：
 * 主视觉进入视口、浏览器空闲之后才 import()，首屏只有静态后备（图片 / CSS）。
 *
 * - 没有 WebGL（或者 ?gl=0）：停在静态后备
 * - prefers-reduced-motion：WebGL 只画一帧，不动
 * - ?sample=1：B、C 用示意数据（见 hero-data.ts）
 */
import { currentVariant } from '../prototype/variants';
import type { Mounted, MountOptions } from './gl-common';

type Mount = (o: MountOptions) => Mounted | null;

const loaders: Record<string, () => Promise<{ mount: Mount }>> = {
  A: () => import('./gl-a'),
  B: () => import('./gl-b'),
  C: () => import('./gl-c'),
};

let mounted: Mounted | null = null;
let generation = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function isSample() {
  return new URL(location.href).searchParams.get('sample') === '1';
}

function stop() {
  generation++;
  mounted?.destroy();
  mounted = null;
  for (const frame of document.querySelectorAll<HTMLElement>('[data-hero-frame]')) {
    frame.dataset.gl = 'off';
    frame.querySelector('canvas')?.remove();
  }
}

/** 等元素进入视口，再等浏览器空闲（最多 1.5 秒） */
function whenVisibleAndIdle(el: Element): Promise<void> {
  return new Promise((resolve) => {
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 1500 });
      else setTimeout(resolve, 200);
    });
    io.observe(el);
  });
}

/** 浏览器能不能开 WebGL：用一个丢弃的 canvas 试一下，不占主视觉那块 canvas */
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

function showDataset(root: HTMLElement) {
  const want = isSample() ? 'sample' : 'real';
  for (const el of root.querySelectorAll<HTMLElement>('[data-dataset]')) el.hidden = el.dataset.dataset !== want;
}

async function start() {
  stop();
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;
  showDataset(root);

  const variant = currentVariant() ?? 'A';
  const panel = root.querySelector<HTMLElement>(`[data-variant="${variant}"]`);
  const frame = [...(panel?.querySelectorAll<HTMLElement>('[data-hero-frame]') ?? [])].find(
    (f) => !f.closest('[data-dataset][hidden]'),
  );
  setUpStarTaps(root);
  if (!frame || !loaders[variant]) return;

  const params = new URL(location.href).searchParams;
  if (params.get('gl') === '0' || !webglAvailable()) return;

  const mine = ++generation;
  await whenVisibleAndIdle(frame);
  const { mount } = await loaders[variant]();
  if (mine !== generation) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  frame.append(canvas);
  mounted = mount({ frame, canvas, still: reduced.matches });
  if (!mounted) {
    canvas.remove();
    return;
  }
  // 第一帧画好再淡入，盖住静态后备
  requestAnimationFrame(() => {
    if (mine === generation) frame.dataset.gl = 'on';
  });
}

/**
 * B 星图：鼠标悬停就显示原名、点一下跳转；触屏上第一次点按只显示原名，再点同一颗才跳转。
 * 点在空白处收起原名。
 */
let lastPointer = 'mouse';
function setUpStarTaps(root: HTMLElement) {
  if (root.dataset.tapsReady) return;
  root.dataset.tapsReady = '1';
  root.addEventListener('pointerdown', (event) => {
    lastPointer = event.pointerType;
  });
  root.addEventListener('click', (event) => {
    const star = (event.target as Element).closest<HTMLElement>('.star');
    const armed = root.querySelector<HTMLElement>('.star.armed');
    if (!star) {
      armed?.classList.remove('armed');
      return;
    }
    if (lastPointer !== 'touch' || star === armed) return;
    event.preventDefault();
    armed?.classList.remove('armed');
    star.classList.add('armed');
  });
}

// 首页在 astro:page-load 时调 showCurrentVariant()，它会发出 prototype:variant，所以这里只听这一个
document.addEventListener('prototype:variant', start);
document.addEventListener('astro:before-swap', stop);
reduced.addEventListener('change', start);

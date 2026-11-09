/**
 * PROTOTYPE（第三轮）：宇宙背景的控制器。这个文件很小，跟着首页一起加载；OGL 和场景代码按需加载：
 * 浏览器空闲之后才 import()，首屏只有静态后备（构建时画好的远景）。
 *
 * - 滚动进度：0 是第一屏，1、2、3 是三摊小册子各自居中；中间按滚动位置插值，停在每一摊附近时多停一会儿
 * - 没有 WebGL（或者 ?gl=0）：停在静态后备
 * - prefers-reduced-motion：WebGL 只画一帧远景，不跟着滚动动
 * - 音乐强弱（pulse.ts）同时交给小册子：写在 --pulse 上，纸跟着透一点光
 * - ?sample=1：星系里的记录星用示意的心头好（现在种子数据里没有心头好）
 */
import type { Mounted, MountOptions } from './gl-common';
import { createPulse, type Pulse } from './pulse';

let mounted: Mounted | null = null;
let generation = 0;
let pulse: Pulse | undefined;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function stop() {
  generation++;
  mounted?.destroy();
  mounted = null;
  const frame = document.querySelector<HTMLElement>('[data-cosmos]');
  if (frame) {
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

/** 某一摊居中时的 scrollY */
function centeredAt(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  return scrollY + rect.top + rect.height / 2 - innerHeight / 2;
}

/**
 * 滚动进度。段与段之间用平滑阶梯：一摊居中前后的一段距离里进度几乎不变（镜头停在星体旁边），
 * 两摊之间的空白里镜头才往前飞。
 */
function makeProgress(spreads: HTMLElement[]): () => number {
  return () => {
    const anchors = [0, ...spreads.map(centeredAt)];
    const y = scrollY;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (y <= b || i === anchors.length - 2) {
        const t = Math.min(Math.max((y - a) / Math.max(b - a, 1), 0), 1);
        const s = Math.min(Math.max((t - 0.12) / 0.76, 0), 1);
        return i + s * s * (3 - 2 * s);
      }
    }
    return anchors.length - 1;
  };
}

/** 星系里的记录星：一个类别一条旋臂，越近完成的越靠旋臂外端，心头好更亮 */
function readRecords(root: HTMLElement): MountOptions['records'] {
  const sample = new URL(location.href).searchParams.get('sample') === '1';
  const raw: { arm: number; along: number; fav: boolean; key: string }[] = JSON.parse(root.dataset.records ?? '[]');
  return raw.map(({ arm, along, fav, key }) => {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const favorite = sample ? h % 7 === 0 : fav;
    return { arm, along, mag: favorite ? 1 : 0.35 };
  });
}

async function start(force = false) {
  const frame = document.querySelector<HTMLElement>('[data-cosmos]');
  // 每个页面只启动一次（模块执行时和 astro:page-load 都会叫到这里）；切换减少动态效果时强制重来
  if (!frame || (frame.dataset.started && !force)) return;
  stop();
  frame.dataset.started = '';
  const params = new URL(location.href).searchParams;
  if (params.get('gl') === '0' || !webglAvailable()) return;

  const mine = ++generation;
  await idle();
  const { mount } = await import('./gl-cosmos');
  if (mine !== generation) return;

  const booklet = document.querySelector<HTMLElement>('[data-booklet]');
  const spreads = [...document.querySelectorAll<HTMLElement>('[data-stop]')];
  pulse ??= createPulse();
  const canvas = document.createElement('canvas');
  frame.append(canvas);
  mounted = mount({
    frame,
    canvas,
    still: reduced.matches,
    pulse,
    records: readRecords(frame),
    progress: makeProgress(spreads),
    onPulse: (level) => booklet?.style.setProperty('--pulse', level.toFixed(3)),
  });
  if (!mounted) {
    canvas.remove();
    return;
  }
  requestAnimationFrame(() => {
    if (mine === generation) frame.dataset.gl = 'on';
  });
}

// 模块可能在 astro:page-load 之后才执行，所以执行时先试一次
start();
document.addEventListener('astro:page-load', () => start());
document.addEventListener('astro:before-swap', stop);
reduced.addEventListener('change', () => start(true));

/** 调试用：现在背景跟着什么在动（audio / demo / none） */
(window as unknown as { backdropPulse?: () => string }).backdropPulse = () => pulse?.source() ?? 'none';

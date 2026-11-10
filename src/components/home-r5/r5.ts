/**
 * PROTOTYPE（首页第五轮）：三个变体的开关。只显示 ?variant= 选中的那一个，只给它启动动画：
 * A 的吸引子、B 的准星、C 的极光和字幕淡入。A、C 是夜里（深色），B 是白纸（浅色）。
 * 减少动态效果时 WebGL 只画一帧，字幕直接全部显示。
 */
import { currentVariant, showCurrentVariant } from '../prototype/variants';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const SCHEME: Record<string, string> = { A: 'dark', B: 'light', C: 'dark' };

let stop: (() => void) | undefined;

const scrollFraction = () => scrollY / Math.max(document.documentElement.scrollHeight - innerHeight, 1);

function pickRandomQuotes(root: HTMLElement) {
  for (const box of root.querySelectorAll<HTMLElement>('[data-random-one]')) {
    const items = [...box.querySelectorAll<HTMLElement>('[data-random-item]')];
    const keep = Math.floor(Math.random() * items.length);
    items.forEach((item, i) => (item.hidden = i !== keep));
  }
}

function setUpAvatars(root: HTMLElement) {
  for (const history of root.querySelectorAll<HTMLElement>('[data-avatar-history]')) {
    if (history.dataset.ready) continue;
    history.dataset.ready = '';
    const slides = [...history.querySelectorAll<HTMLElement>('[data-avatar-slide]')];
    const buttons = [...history.querySelectorAll<HTMLButtonElement>('[data-avatar-step]')];
    let index = 0;
    const render = () => {
      slides.forEach((s, i) => (s.hidden = i !== index));
      for (const b of buttons) {
        const next = index + Number(b.dataset.avatarStep);
        b.disabled = next < 0 || next >= slides.length;
      }
    };
    for (const b of buttons) {
      b.addEventListener('click', () => {
        index = Math.min(slides.length - 1, Math.max(0, index + Number(b.dataset.avatarStep)));
        render();
      });
    }
    render();
  }
}

async function startA(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-a-canvas]')!;
  const { mountAttractor } = await import('./a-attractor');
  return mountAttractor(canvas, { still: reduced.matches, scroll: scrollFraction }) ?? undefined;
}

function startB(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-b-chart]')!;
  const reticle = root.querySelector<SVGGElement>('[data-b-reticle]')!;
  const coord = root.querySelector<SVGTextElement>('[data-b-coord]')!;
  const move = (e: PointerEvent) => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const dx = pt.x - 500;
    const dy = pt.y - 500;
    const r = Math.hypot(dx, dy);
    if (r > 482) {
      reticle.classList.remove('on');
      return;
    }
    reticle.classList.add('on');
    reticle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    // 极点在中心：离中心越远赤纬越低；角度换成赤经的时、分
    const ra = (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) / 15;
    const dec = 90 - (r / 482) * 120;
    const h = Math.floor(ra);
    const m = Math.floor((ra - h) * 60);
    coord.textContent = `${h}h${String(m).padStart(2, '0')}m  ${dec >= 0 ? '+' : '−'}${Math.abs(dec).toFixed(0)}°`;
  };
  const leave = () => reticle.classList.remove('on');
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  return () => {
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
  };
}

async function startC(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-c-canvas]')!;
  const items = [...root.querySelectorAll<HTMLElement>('[data-c-reveal]')];
  let io: IntersectionObserver | undefined;
  if (!reduced.matches) {
    root.dataset.motion = '';
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
      },
      { threshold: 0.4 },
    );
    items.forEach((el) => io!.observe(el));
  }
  const { mountAurora } = await import('./c-aurora');
  const off = mountAurora(canvas, { still: reduced.matches, scroll: scrollFraction });
  return () => {
    io?.disconnect();
    delete root.dataset.motion;
    items.forEach((el) => el.classList.remove('in'));
    off?.();
  };
}

let applied: string | undefined;
let current: symbol | undefined;

async function apply(force = false) {
  if (!document.querySelector('[data-prototype-variants]')) return;
  const key = currentVariant() ?? 'A';
  if (key === applied && !force) return;
  applied = key;
  stop?.();
  stop = undefined;
  showCurrentVariant();
  document.documentElement.style.colorScheme = SCHEME[key] ?? 'dark';
  const root = document.querySelector<HTMLElement>(`[data-variant="${key}"]`)!;
  setUpAvatars(root);
  const mine = Symbol();
  current = mine;
  const off = key === 'A' ? await startA(root) : key === 'B' ? startB(root) : await startC(root);
  if (current !== mine) off?.();
  else stop = off;
}

document.addEventListener('astro:page-load', () => {
  const host = document.querySelector<HTMLElement>('[data-prototype-variants]');
  if (!host) return;
  pickRandomQuotes(host);
  applied = undefined;
  apply();
});
// 切换条换了变体：variants.ts 的 stepVariant 改了地址栏以后派发 prototype:variant
document.addEventListener('prototype:variant', () => apply());
document.addEventListener('astro:before-swap', () => {
  stop?.();
  stop = undefined;
  applied = undefined;
  document.documentElement.style.colorScheme = '';
});
reduced.addEventListener('change', () => apply(true));

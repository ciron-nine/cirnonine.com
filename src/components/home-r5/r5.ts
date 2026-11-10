/**
 * PROTOTYPE（首页第五轮）：三个变体的开关。只显示 ?variant= 选中的那一个，只给它启动动画：
 * A 的吸引子、B（和 B2）的星图交互。A 是夜里（深色），B 是白纸（浅色）。
 * 减少动态效果时 WebGL 只画一帧，星图不动。
 */
import { currentVariant, showCurrentVariant } from '../prototype/variants';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const SCHEME: Record<string, string> = { A: 'dark', B: 'light', B2: 'light' };

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
  // 粒子流要 WebGL2 和浮点纹理；没有的话页面上只有蓝晒纸
  const { mountFlow } = await import('./a-flow');
  return mountFlow(canvas, { still: reduced.matches, scroll: scrollFraction }) ?? undefined;
}

/**
 * B（和 B2）的星图：缩放和拖动（改 viewBox）、按缩放级别换名字、准星、星和星表互相点亮、流星。
 * 名字的位置构建时按 1×、2×、4× 三级算好（b-chart-data.ts），这里只决定现在显示哪一级。
 */
function startB(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-b-chart]')!;
  const reticle = root.querySelector<SVGGElement>('[data-b-reticle]')!;
  const coord = root.querySelector<SVGTextElement>('[data-b-coord]')!;
  const meteor = root.querySelector<SVGPathElement>('[data-b-meteor]')!;
  const still = reduced.matches;
  const offs: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn as EventListener, opts);
    offs.push(() => el.removeEventListener(type, fn as EventListener, opts));
  };

  // 动画的开关写在 .b 上（VariantB.astro 的样式是 .b[data-motion] …）
  const chartRoot = root.querySelector<HTMLElement>('[data-b]')!;
  if (!still) chartRoot.dataset.motion = '';

  // ---------- 缩放和拖动 ----------
  let view = { z: 1, cx: 500, cy: 500 };
  let anim = 0;
  const clampView = (v: typeof view) => {
    const z = Math.min(Math.max(v.z, 1), 6);
    const half = 500 / z;
    return { z, cx: Math.min(Math.max(v.cx, half), 1000 - half), cy: Math.min(Math.max(v.cy, half), 1000 - half) };
  };
  const apply = (v: typeof view) => {
    const w = 1000 / v.z;
    svg.setAttribute('viewBox', `${(v.cx - w / 2).toFixed(2)} ${(v.cy - w / 2).toFixed(2)} ${w.toFixed(2)} ${w.toFixed(2)}`);
    svg.style.setProperty('--zs', Math.sqrt(v.z).toFixed(3));
    const lod = v.z < 1.6 ? 1 : v.z < 3.2 ? 2 : 4;
    if (svg.dataset.lod !== String(lod)) {
      svg.dataset.lod = String(lod);
      svg.style.setProperty('--z', String(lod));
    }
  };
  const go = (target: typeof view) => {
    target = clampView(target);
    cancelAnimationFrame(anim);
    if (still) {
      view = target;
      apply(view);
      return;
    }
    const from = { ...view };
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / 450, 1);
      const e = 1 - Math.pow(1 - t, 3);
      // 缩放按对数插值，看起来匀速
      view = {
        z: Math.exp(Math.log(from.z) + (Math.log(target.z) - Math.log(from.z)) * e),
        cx: from.cx + (target.cx - from.cx) * e,
        cy: from.cy + (target.cy - from.cy) * e,
      };
      apply(view);
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  };
  const toChart = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!.inverse());

  on(svg, 'wheel', (e: WheelEvent) => {
    e.preventDefault();
    const p = toChart(e.clientX, e.clientY);
    const z = Math.min(Math.max(view.z * Math.exp(-e.deltaY * 0.0018), 1), 6);
    // 鼠标指着的那一点缩放前后不动
    const k = view.z / z;
    view = clampView({ z, cx: p.x + (view.cx - p.x) * k, cy: p.y + (view.cy - p.y) * k });
    cancelAnimationFrame(anim);
    apply(view);
  }, { passive: false });

  let drag: { x: number; y: number; cx: number; cy: number } | undefined;
  on(svg, 'pointerdown', (e: PointerEvent) => {
    if ((e.target as Element).closest('.b-star, [data-zoom-to]') || view.z <= 1.001) return;
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
  });
  on(svg, 'pointermove', (e: PointerEvent) => {
    if (!drag) return;
    const scale = 1000 / view.z / svg.getBoundingClientRect().width;
    view = clampView({ z: view.z, cx: drag.cx - (e.clientX - drag.x) * scale, cy: drag.cy - (e.clientY - drag.y) * scale });
    apply(view);
  });
  const endDrag = () => {
    drag = undefined;
    svg.classList.remove('dragging');
  };
  on(svg, 'pointerup', endDrag);
  on(svg, 'pointercancel', endDrag);

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
    on(button, 'click', () => {
      const kind = button.dataset.zoom;
      if (kind === 'reset') go({ z: 1, cx: 500, cy: 500 });
      else go({ ...view, z: view.z * (kind === 'in' ? 1.8 : 1 / 1.8) });
    });
  }
  // 点类别名（星图上的、星表里的）缩放到那个天区
  for (const el of root.querySelectorAll<HTMLElement | SVGElement>('[data-zoom-to]')) {
    const [cx, cy] = el.dataset.zoomTo!.split(',').map(Number);
    const focus = () => {
      go({ z: 2.6, cx, cy });
      if (innerWidth < 768) svg.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    };
    on(el, 'click', focus);
    on(el, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focus();
      }
    });
  }

  // ---------- 准星：读坐标；指着星时读出它的名字 ----------
  on(svg, 'pointermove', (e: PointerEvent) => {
    const pt = toChart(e.clientX, e.clientY);
    const dx = pt.x - 500;
    const dy = pt.y - 500;
    const r = Math.hypot(dx, dy);
    if (r > 482 || e.pointerType === 'touch') {
      reticle.classList.remove('on');
      return;
    }
    reticle.classList.add('on');
    // 准星在屏幕上保持一样大
    const s = 1 / view.z;
    reticle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${s})`);
    const star = (e.target as Element).closest<SVGElement>('.b-star');
    if (star) {
      coord.textContent = star.dataset.title ?? '';
      return;
    }
    const ra = (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) / 15;
    const dec = 90 - (r / 482) * 120;
    const h = Math.floor(ra);
    const m = Math.floor((ra - h) * 60);
    coord.textContent = `${h}h${String(m).padStart(2, '0')}m  ${dec >= 0 ? '+' : '−'}${Math.abs(dec).toFixed(0)}°`;
  });
  on(svg, 'pointerleave', () => reticle.classList.remove('on'));

  // ---------- 星和星表互相点亮；指一颗星，它的整个系列亮起来 ----------
  const lit: Element[] = [];
  const clear = () => {
    for (const el of lit) el.classList.remove('lit');
    lit.length = 0;
  };
  const light = (key: string | undefined, series: string | undefined) => {
    clear();
    const add = (els: Iterable<Element>) => {
      for (const el of els) {
        el.classList.add('lit');
        lit.push(el);
      }
    };
    if (key) add(root.querySelectorAll(`[data-key="${CSS.escape(key)}"]`));
    if (series) add(root.querySelectorAll(`[data-series="${CSS.escape(series)}"]`));
  };
  const hoverStar = (e: Event) => {
    const star = (e.target as Element).closest<SVGElement>('.b-star');
    if (star) light(star.dataset.key, star.dataset.series);
  };
  on(svg, 'pointerover', hoverStar);
  on(svg, 'focusin', hoverStar);
  on(svg, 'pointerout', (e: PointerEvent) => {
    if ((e.target as Element).closest('.b-star')) clear();
  });
  on(svg, 'focusout', clear);
  for (const row of root.querySelectorAll<HTMLElement>('tr[data-key]')) {
    const star = root.querySelector<SVGElement>(`.b-star[data-key="${CSS.escape(row.dataset.key!)}"]`);
    on(row, 'pointerenter', () => light(row.dataset.key, star?.dataset.series));
    on(row, 'pointerleave', clear);
  }

  // ---------- 流星：隔 8–15 秒一颗，从星图边上斜着划进来 ----------
  let timer = 0;
  const fly = () => {
    const a = Math.random() * Math.PI * 2;
    const r = 200 + Math.random() * 220;
    const x0 = 500 + Math.cos(a) * r;
    const y0 = 500 + Math.sin(a) * r;
    const dir = a + Math.PI * (0.75 + Math.random() * 0.5);
    meteor.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} L${(x0 + Math.cos(dir) * 220).toFixed(1)} ${(y0 + Math.sin(dir) * 220).toFixed(1)}`);
    meteor.classList.remove('fly');
    void meteor.getBoundingClientRect();
    meteor.classList.add('fly');
    timer = window.setTimeout(fly, 8000 + Math.random() * 7000);
  };
  if (!still) timer = window.setTimeout(fly, 4200);

  return () => {
    offs.forEach((off) => off());
    clearTimeout(timer);
    cancelAnimationFrame(anim);
    clear();
    delete chartRoot.dataset.motion;
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.dataset.lod = '1';
    svg.style.setProperty('--z', '1');
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
  const off = key === 'A' ? await startA(root) : startB(root);
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

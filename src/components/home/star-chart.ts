/**
 * 首页记录星图的交互（StarChart.astro）：
 * - 缩放和拖动：改 svg 的 viewBox。滚轮缩放时鼠标指着的点不动；放大以后可以拖；＋ － 全图三个按钮；
 *   点类别名（星图上的天区名、星表里的件数）缩放到那个天区
 * - 名字：构建时按 1×、2×、4× 三级算好位置（lib/star-chart.ts），这里只决定现在显示哪一级（svg 的 data-lod）
 * - 准星：跟着鼠标读出坐标；指着星时读出它的名字
 * - 点亮：指一颗星，它的整个系列和星表里那一行一起亮；指星表里的一行，星图上那颗星亮
 * - 流星：隔 8–15 秒一颗
 * - 键盘：星图只占一个 Tab 位置（一颗星 tabindex=0，其余 -1），方向键在星之间移动，Home / End 到头尾；
 *   聚焦的星不在当前视野里时，平移过去
 * 减少动态效果时：不加 data-motion（没有印上去、闪、摆），没有流星，缩放直接跳过去。
 */
import { CENTER, RADIUS, SIZE } from '../../lib/star-chart-frame';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function mountStarChart(root: HTMLElement): () => void {
  const svg = root.querySelector('svg')!;
  const reticle = root.querySelector<SVGGElement>('[data-reticle]')!;
  const coord = root.querySelector<SVGTextElement>('[data-reticle-label]')!;
  const meteor = root.querySelector<SVGPathElement>('[data-meteor]')!;
  const still = reduced.matches;
  const offs: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn as EventListener, opts);
    offs.push(() => el.removeEventListener(type, fn as EventListener, opts));
  };

  if (!still) root.dataset.motion = '';

  // ---------- 缩放和拖动 ----------
  let view = { z: 1, cx: CENTER, cy: CENTER };
  let anim = 0;
  const clampView = (v: typeof view) => {
    const z = Math.min(Math.max(v.z, 1), 6);
    const half = CENTER / z;
    return { z, cx: Math.min(Math.max(v.cx, half), SIZE - half), cy: Math.min(Math.max(v.cy, half), SIZE - half) };
  };
  const apply = (v: typeof view) => {
    const w = SIZE / v.z;
    svg.setAttribute('viewBox', `${(v.cx - w / 2).toFixed(2)} ${(v.cy - w / 2).toFixed(2)} ${w.toFixed(2)} ${w.toFixed(2)}`);
    svg.style.setProperty('--zs', Math.sqrt(v.z).toFixed(3));
    // 放大以后手指拖动是平移星图；没放大时让给页面滚动
    svg.style.touchAction = v.z > 1.001 ? 'none' : '';
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
    if ((e.target as Element).closest('.star, [data-zoom-to]') || view.z <= 1.001) return;
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
  });
  on(svg, 'pointermove', (e: PointerEvent) => {
    if (!drag) return;
    const scale = SIZE / view.z / svg.getBoundingClientRect().width;
    view = clampView({ z: view.z, cx: drag.cx - (e.clientX - drag.x) * scale, cy: drag.cy - (e.clientY - drag.y) * scale });
    apply(view);
  });
  const endDrag = () => {
    drag = undefined;
    svg.classList.remove('dragging');
  };
  on(svg, 'pointerup', endDrag);
  on(svg, 'pointercancel', endDrag);

  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-zoom]')) {
    on(button, 'click', () => {
      const kind = button.dataset.zoom;
      if (kind === 'reset') go({ z: 1, cx: CENTER, cy: CENTER });
      else go({ ...view, z: view.z * (kind === 'in' ? 1.8 : 1 / 1.8) });
    });
  }
  // 点类别名（星图上的、星表里的件数）缩放到那个天区
  for (const el of document.querySelectorAll<HTMLElement | SVGElement>('[data-zoom-to]')) {
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
    const dx = pt.x - CENTER;
    const dy = pt.y - CENTER;
    const r = Math.hypot(dx, dy);
    if (r > RADIUS || e.pointerType === 'touch') {
      reticle.classList.remove('on');
      return;
    }
    reticle.classList.add('on');
    // 准星在屏幕上保持一样大
    const s = 1 / view.z;
    reticle.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${s})`);
    const star = (e.target as Element).closest<SVGElement>('.star');
    if (star) {
      coord.textContent = star.dataset.originalTitle ?? '';
      return;
    }
    const ra = (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) / 15;
    const dec = 90 - (r / RADIUS) * 120;
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
    if (key) add(document.querySelectorAll(`[data-key="${CSS.escape(key)}"]`));
    if (series) add(root.querySelectorAll(`[data-series="${CSS.escape(series)}"]`));
  };
  const hoverStar = (e: Event) => {
    const star = (e.target as Element).closest<SVGElement>('.star');
    if (star) light(star.dataset.key, star.dataset.series);
  };
  on(svg, 'pointerover', hoverStar);
  on(svg, 'focusin', hoverStar);
  on(svg, 'pointerout', (e: PointerEvent) => {
    if ((e.target as Element).closest('.star')) clear();
  });
  on(svg, 'focusout', clear);
  for (const row of document.querySelectorAll<HTMLElement>('tr[data-key]')) {
    const star = root.querySelector<SVGElement>(`.star[data-key="${CSS.escape(row.dataset.key!)}"]`);
    on(row, 'pointerenter', () => light(row.dataset.key, star?.dataset.series));
    on(row, 'pointerleave', clear);
  }

  // ---------- 键盘：一个 Tab 位置，方向键在星之间移动 ----------
  const starLinks = [...root.querySelectorAll<SVGAElement>('a.star')];
  const rove = (index: number) => {
    starLinks.forEach((a, i) => a.setAttribute('tabindex', i === index ? '0' : '-1'));
  };
  rove(0);
  on(svg, 'keydown', (e: KeyboardEvent) => {
    const at = starLinks.indexOf((e.target as Element).closest('a.star') as SVGAElement);
    if (at < 0) return;
    const n = starLinks.length;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at - 1 + n) % n
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    rove(next);
    starLinks[next].focus();
  });
  // 聚焦的星在视野外（放大看着别处时）就平移过去
  on(svg, 'focusin', (e: FocusEvent) => {
    const dot = (e.target as Element).closest('a.star')?.querySelector<SVGCircleElement>('.dot');
    if (!dot) return;
    const x = dot.cx.baseVal.value;
    const y = dot.cy.baseVal.value;
    const half = CENTER / view.z;
    if (Math.abs(x - view.cx) > half * 0.9 || Math.abs(y - view.cy) > half * 0.9) go({ z: view.z, cx: x, cy: y });
  });

  // ---------- 流星：隔 8–15 秒一颗，从星图边上斜着划进来 ----------
  let timer = 0;
  const fly = () => {
    const a = Math.random() * Math.PI * 2;
    const r = 200 + Math.random() * 220;
    const x0 = CENTER + Math.cos(a) * r;
    const y0 = CENTER + Math.sin(a) * r;
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
    delete root.dataset.motion;
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.style.touchAction = '';
    starLinks.forEach((a) => a.removeAttribute('tabindex'));
    svg.dataset.lod = '1';
    svg.style.setProperty('--z', '1');
  };
}

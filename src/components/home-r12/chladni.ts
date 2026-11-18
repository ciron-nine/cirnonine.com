/**
 * PROTOTYPE（首页第十二轮）：克拉尼板（Chladni.astro）。
 * - 画面：每一帧按 plate.ts 走一步沙子，画到画布上；作品的沙大一点、亮一点
 * - 自己奏：没人碰的时候，隔一阵换下一个模式，轻轻「拉」一下，沙子流向新的花纹
 * - 拉弓：指针（手指）贴着板沿移动就是拉弓，沿板沿的位置决定拉出哪个模式，移动得越快振得越厉害，并发出那个音
 * - 指着一粒作品的沙：读出名字，叮一声；点下去打开它。方向键在作品之间移动，回车打开
 * - 四边的类别：点一个，换到那个类别的模式，那个类别的作品亮起来
 * - 减少动态效果：不自己奏，换模式时沙子直接落到新的节线上
 */
import { bow, ping, release } from './bow';
import { CATEGORY_MODE, frequency, MODES, modeLabel, rng, scatter, settle, step, type Mode } from './plate';

interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: string;
  categoryLabel: string;
  date: { precision: string; year?: number; month?: number; day?: number };
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dateLabel = (d: Rec['date']) =>
  d.precision === 'day' ? `${d.year}年${d.month}月${d.day}日` : d.precision === 'month' ? `${d.year}年${d.month}月` : d.precision === 'year' ? `${d.year}年` : '很久以前';

export function mountChladni(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-cl]')!;
  const plate = root.querySelector<HTMLElement>('[data-plate]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-sand]')!;
  const surface = root.querySelector<HTMLElement>('[data-surface]')!;
  const modeEl = root.querySelector<HTMLElement>('[data-mode]')!;
  const hzEl = root.querySelector<HTMLElement>('[data-hz]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const subEl = root.querySelector<HTMLElement>('[data-sub]')!;
  const hint = root.querySelector<HTMLElement>('[data-hint]')!;
  const sideButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-cat]')];
  const still = reduced.matches;
  const records: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');

  const rand = rng(17);
  const mobile = innerWidth < 820;
  const COUNT = mobile ? 7000 : 16000;
  const grains = scatter(COUNT, rand);
  // 前面几粒是作品
  const R = records.length;

  let mode: Mode = MODES[Math.floor(Date.now() / 864e5) % MODES.length];
  let energy = 0;
  let sustain = 0; // 弓还压着（或者自己在奏）时，能量往这个数靠
  let litCat: string | undefined;
  let hover = -1;
  let bowAt: { x: number; y: number; nx: number; ny: number } | undefined;
  let lastUser = -1e9;
  let audioOn = false;

  const show = () => {
    modeEl.textContent = modeLabel(mode);
    hzEl.textContent = `≈ ${Math.round(frequency(mode)).toLocaleString('en-US')} Hz　克拉尼图形`;
    for (const b of sideButtons) b.setAttribute('aria-pressed', String(b.dataset.cat === litCat));
  };
  const setMode = (next: Mode) => {
    if (next.m === mode.m && next.n === mode.n && next.sign === mode.sign) return false;
    mode = next;
    if (still) settle(grains, mode, rand);
    show();
    return true;
  };

  // ---------- 画 ----------
  let W = 0;
  let S = 0;
  let M = 0;
  let dpr = 1;
  let ctx = canvas.getContext('2d')!;
  let img: ImageData | undefined;
  const size = () => {
    dpr = Math.min(devicePixelRatio, 2);
    W = canvas.clientWidth;
    S = plate.clientWidth;
    M = (W - S) / 2;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(W * dpr);
    ctx = canvas.getContext('2d')!;
    img = ctx.createImageData(canvas.width, canvas.height);
  };
  /** 板上坐标（0..1）→ 画布上的 CSS 像素 */
  const px = (u: number) => M + u * S;

  const render = () => {
    if (!img) return;
    const data = img.data;
    data.fill(0);
    const cw = canvas.width;
    const g = Math.max(1, Math.round(dpr));
    for (let i = R; i < COUNT; i++) {
      const x = Math.round(px(grains.x[i]) * dpr);
      const y = Math.round(px(grains.y[i]) * dpr);
      for (let dy = 0; dy < g; dy++)
        for (let dx = 0; dx < g; dx++) {
          const k = ((y + dy) * cw + x + dx) * 4;
          data[k] = 232;
          data[k + 1] = 226;
          data[k + 2] = 212;
          data[k + 3] = Math.min(255, data[k + 3] + 150);
        }
    }
    ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.scale(dpr, dpr);
    // 作品的沙：大一点、亮一点；这个类别被点亮时，别的类别暗下去
    for (let i = 0; i < R; i++) {
      const x = px(grains.x[i]);
      const y = px(grains.y[i]);
      const on = i === hover;
      const dim = litCat && records[i].category !== litCat;
      ctx.globalAlpha = dim ? 0.25 : 1;
      if (on) {
        ctx.strokeStyle = '#cfa75e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = on ? '#cfa75e' : '#ffffff';
      ctx.shadowColor = on ? '#cfa75e' : 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = on ? 10 : 5;
      ctx.beginPath();
      ctx.arc(x, y, on ? 2.8 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    // 弓：一道铜色的线，压在板沿上
    if (bowAt && sustain > 0.05) {
      ctx.strokeStyle = `rgba(207,167,94,${Math.min(1, sustain + 0.2).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      const L = S * 0.16;
      ctx.beginPath();
      ctx.moveTo(bowAt.x - bowAt.ny * L, bowAt.y + bowAt.nx * L);
      ctx.lineTo(bowAt.x + bowAt.ny * L, bowAt.y - bowAt.nx * L);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- 动 ----------
  let raf = 0;
  let last = performance.now();
  let nextAuto = performance.now() + 1200;
  let autoIdx = MODES.indexOf(mode);
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 16.7, 3);
    last = now;
    // 没人碰的时候自己奏：拉一下，停一阵，再换下一个模式
    if (!still && now - lastUser > 9000 && now > nextAuto) {
      autoIdx = (autoIdx + 1) % MODES.length;
      setMode(MODES[autoIdx]);
      sustain = 0.75;
      bowAt = undefined;
      nextAuto = now + 9000;
    }
    if (now - lastUser > 9000 && now > nextAuto - 9000 + 2600) sustain *= 0.94;
    energy += (sustain - energy) * 0.08 * dt;
    if (!bowAt || now - lastUser > 300) sustain *= Math.pow(0.985, dt);
    if (audioOn) {
      if (sustain > 0.05 && now - lastUser < 600) bow(frequency(mode), sustain);
      else release();
    }
    for (let k = 0; k < Math.round(dt); k++) step(grains, mode, energy, rand);
    render();
  };

  // ---------- 拉弓、指着、点 ----------
  const local = (e: PointerEvent) => {
    const r = plate.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  };
  let prev: { u: number; v: number; t: number } | undefined;
  const onMove = (e: PointerEvent) => {
    const { u, v } = local(e);
    const now = performance.now();
    // 离板沿多近：在板沿内外各 6% 以内就是在拉弓
    const d = Math.min(Math.abs(u), Math.abs(1 - u), Math.abs(v), Math.abs(1 - v));
    const nearEdge = d < 0.06 && u > -0.06 && u < 1.06 && v > -0.06 && v < 1.06;
    if (nearEdge && prev) {
      const speed = Math.hypot(u - prev.u, v - prev.v) / Math.max(now - prev.t, 1);
      // 板沿一圈拉成一条：上边从左到右、右边从上到下……位置决定模式
      const edge = d === Math.abs(v) ? 0 : d === Math.abs(1 - u) ? 1 : d === Math.abs(1 - v) ? 2 : 3;
      const along = edge === 0 ? u : edge === 1 ? v : edge === 2 ? 1 - u : 1 - v;
      const t = (edge + Math.min(Math.max(along, 0), 0.999)) / 4;
      if (setMode(MODES[Math.floor(t * MODES.length)])) litCat = undefined;
      sustain = Math.min(1, sustain + speed * 40);
      const cu = Math.min(Math.max(u, 0), 1);
      const cv = Math.min(Math.max(v, 0), 1);
      const nx = edge === 1 ? 1 : edge === 3 ? -1 : 0;
      const ny = edge === 2 ? 1 : edge === 0 ? -1 : 0;
      bowAt = { x: px(cu), y: px(cv), nx, ny };
      lastUser = now;
      hint.dataset.gone = '';
    } else if (!nearEdge) {
      bowAt = undefined;
    }
    prev = { u, v, t: now };
    // 指着作品的沙
    let best = -1;
    let bestD = (14 / S) ** 2;
    for (let i = 0; i < R; i++) {
      const dd = (grains.x[i] - u) ** 2 + (grains.y[i] - v) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    pick(best);
  };
  const pick = (i: number) => {
    if (i === hover) return;
    hover = i;
    surface.style.cursor = i >= 0 ? 'pointer' : 'crosshair';
    if (i < 0) {
      titleEl.textContent = '';
      subEl.textContent = '';
      return;
    }
    const r = records[i];
    titleEl.textContent = r.title;
    if (r.lang) titleEl.lang = r.lang;
    else titleEl.removeAttribute('lang');
    subEl.textContent = `${r.categoryLabel}　${dateLabel(r.date)}`;
    if (audioOn) ping(frequency(mode) * (1.5 + (i % 5) * 0.25));
    if (still) render();
  };
  const onDown = () => {
    audioOn = true;
    lastUser = performance.now();
  };
  const onClick = () => {
    if (hover >= 0) location.href = records[hover].href;
  };
  const onLeave = () => {
    bowAt = undefined;
    prev = undefined;
    pick(-1);
  };
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('click', onClick);
  surface.addEventListener('pointerleave', onLeave);

  // 键盘：方向键在作品之间走，回车打开
  const onKey = (e: KeyboardEvent) => {
    if (!R) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pick((hover + 1 + R) % R);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') pick((hover - 1 + R) % R);
    else if (e.key === 'Enter' && hover >= 0) location.href = records[hover].href;
    else return;
    e.preventDefault();
  };
  surface.addEventListener('keydown', onKey);

  // 四边的类别
  const offs: (() => void)[] = [];
  for (const b of sideButtons) {
    const fn = () => {
      audioOn = true;
      lastUser = performance.now();
      litCat = litCat === b.dataset.cat ? undefined : b.dataset.cat;
      setMode(CATEGORY_MODE[b.dataset.cat!]);
      sustain = 1;
      show();
      if (still) render();
      // 拉一下，一秒半后弓离开
      window.setTimeout(() => (lastUser = performance.now() - 700), 1500);
    };
    b.addEventListener('click', fn);
    offs.push(() => b.removeEventListener('click', fn));
  }

  // ---------- 开始 ----------
  size();
  show();
  if (still) {
    settle(grains, mode, rand);
    render();
  } else {
    // 打开时：沙子均匀撒满整块板，轻轻一拉，聚成第一个花纹
    sustain = 0.9;
    nextAuto = performance.now() + 9000;
    raf = requestAnimationFrame(tick);
  }
  const ro = new ResizeObserver(() => {
    size();
    render();
  });
  ro.observe(plate);
  if (new URL(location.href).searchParams.get('sample') === '1') root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    release();
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('click', onClick);
    surface.removeEventListener('pointerleave', onLeave);
    surface.removeEventListener('keydown', onKey);
    offs.forEach((off) => off());
  };
}

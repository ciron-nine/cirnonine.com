/**
 * PROTOTYPE（首页第十五轮）：编舞（Choreo.astro）。
 * - 两层画布：下面是几支舞的轨道（细线，静态），上面是星（每一帧淡淡地擦掉上一帧，留下拖尾）
 * - 打开时：每支舞的星从同一点出发，沿着轨道散开到各自的位置，像一个个入场
 * - 指针是一颗看不见的小质量：经过的星会被它轻轻拉偏一点
 * - 点一支舞的名字：它亮起来，别的退远；再点一下回来
 * - 指着一颗星：旁边浮出名字，左下角读出它的类别和日期；点它打开
 * - 减少动态效果：星停在各自的位置，没有拖尾
 */
import { at, dances, hash, normal, seats, type Dance, type Seat } from './dance';

interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: string;
  categoryLabel: string;
  date: { precision: string; year?: number; month?: number; day?: number };
  coverColor?: string;
}
interface Star {
  r: Rec;
  k: number;
  seat: Seat;
  rgb: [number, number, number];
  twinkle: number;
  x: number;
  y: number;
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dateLabel = (d: Rec['date']) =>
  d.precision === 'day' ? `${d.year}年${d.month}月${d.day}日` : d.precision === 'month' ? `${d.year}年${d.month}月` : d.precision === 'year' ? `${d.year}年` : '很久以前';

/** 星的颜色：封面主色往白里调亮一点（星光是亮的）；没有封面就是暖白 */
function starRGB(hex: string | undefined, key: string): [number, number, number] {
  let r = 236;
  let g = 233;
  let b = 222;
  if (hex) {
    const n = parseInt(hex.slice(1), 16);
    r = n >> 16;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    // 示意：随便一种淡淡的颜色
    const h = hash(key + 'c') * 360;
    const c = (o: number) => Math.round(200 + 55 * Math.cos(((h + o) * Math.PI) / 180));
    [r, g, b] = [c(0), c(120), c(240)];
  }
  const mix = (v: number) => Math.round(v * 0.55 + 255 * 0.45);
  return [mix(r), mix(g), mix(b)];
}

/** ?sample=many：6 个类别，从 1000 到 3 */
function manyRecords(): Rec[] {
  const cats: [string, string, number][] = [
    ['games', '游戏', 1000],
    ['visual-novels', '视觉小说', 12],
    ['anime', '动画', 240],
    ['songs', '音乐', 40],
    ['books', '书', 9],
    ['films', '电影', 3],
  ];
  return cats.flatMap(([key, label, n]) =>
    Array.from({ length: n }, (_, i) => ({
      key: `${key}/${i}`,
      title: `示意的${label} ${String(i + 1).padStart(n > 99 ? 4 : 2, '0')}`,
      href: '#',
      category: key,
      categoryLabel: label,
      date: { precision: 'long-ago' },
    })),
  );
}

export function mountChoreo(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-ch]')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const orbitCanvas = root.querySelector<HTMLCanvasElement>('[data-orbits]')!;
  const starCanvas = root.querySelector<HTMLCanvasElement>('[data-stars]')!;
  const namesEl = root.querySelector<HTMLElement>('[data-names]')!;
  const tip = root.querySelector<HTMLElement>('[data-tip]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const subEl = root.querySelector<HTMLElement>('[data-sub]')!;
  const roster = root.querySelector<HTMLElement>('[data-roster]')!;
  const still = reduced.matches;
  const mode = new URL(location.href).searchParams.get('sample');
  const real: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  const records = mode === 'many' ? manyRecords() : real;
  if (mode) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  // 类别：按出现的先后
  const cats: { key: string; label: string; recs: Rec[] }[] = [];
  for (const r of records) {
    let c = cats.find((x) => x.key === r.category);
    if (!c) cats.push((c = { key: r.category, label: r.categoryLabel, recs: [] }));
    c.recs.push(r);
  }
  const ds: Dance[] = dances(cats.length);
  const stars: Star[] = cats.flatMap((c, k) => {
    const ss = seats(c.recs.length);
    return c.recs.map((r, i) => ({ r, k, seat: ss[i], rgb: starRGB(r.coverColor, r.key), twinkle: hash(r.key + 't'), x: 0, y: 0 }));
  });

  // ---------- 大小 ----------
  let W = 0;
  let H = 0;
  let RX = 0;
  let RY = 0;
  let cx = 0;
  let cy = 0;
  let dpr = 1;
  let laneGap = 4;
  const octx = orbitCanvas.getContext('2d')!;
  const sctx = starCanvas.getContext('2d')!;
  let focus: number | undefined;
  const buttons: HTMLButtonElement[] = [];

  const drawOrbits = () => {
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    ds.forEach((d, k) => {
      const on = focus === undefined || focus === k;
      octx.strokeStyle = on ? (focus === k ? 'rgba(236,233,222,0.32)' : 'rgba(236,233,222,0.12)') : 'rgba(236,233,222,0.04)';
      octx.lineWidth = focus === k ? 1 : 0.75;
      octx.beginPath();
      for (let i = 0; i <= 600; i++) {
        const [x, y] = at(d, i / 600);
        const px = cx + x * RX;
        const py = cy + y * RY;
        if (i === 0) octx.moveTo(px, py);
        else octx.lineTo(px, py);
      }
      octx.stroke();
    });
  };

  // 每支舞的名字：放在这支舞朝某个方向伸得最远的地方，几个方向均匀错开
  const placeNames = () => {
    ds.forEach((d, k) => {
      const dir = -Math.PI / 2 + (k / ds.length) * Math.PI * 2;
      const ux = Math.cos(dir);
      const uy = Math.sin(dir);
      let best = -Infinity;
      let bx = 0;
      let by = 0;
      for (let i = 0; i < 400; i++) {
        const [x, y] = at(d, i / 400);
        const s = x * ux * RX + y * uy * RY;
        if (s > best) {
          best = s;
          bx = cx + x * RX;
          by = cy + y * RY;
        }
      }
      const b = buttons[k];
      const lx = Math.min(Math.max(bx + ux * 26, 70), W - 70);
      const ly = Math.min(Math.max(by + uy * 22, 30), H - 40);
      b.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
    });
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    for (const c of [orbitCanvas, starCanvas]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    cx = W / 2;
    cy = H * 0.48;
    RX = Math.min(W * 0.44, H * 0.7);
    RY = H * 0.4;
    laneGap = Math.max(1.6, Math.min(4, 40 / Math.max(...stars.map((s) => s.seat.lanes), 1)));
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOrbits();
    placeNames();
  };

  // ---------- 名字按钮 ----------
  namesEl.replaceChildren();
  cats.forEach((c, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span></span><span class="n"></span>';
    b.querySelector('span')!.textContent = c.label;
    b.querySelector('.n')!.textContent = String(c.recs.length);
    b.addEventListener('click', () => {
      focus = focus === k ? undefined : k;
      buttons.forEach((x, j) => {
        x.setAttribute('aria-pressed', String(focus === j));
        x.classList.toggle('away', focus !== undefined && focus !== j);
      });
      drawOrbits();
    });
    namesEl.append(b);
    buttons.push(b);
  });

  // ---------- 名单 ----------
  roster.replaceChildren();
  for (const c of cats) {
    const col = document.createElement('section');
    col.innerHTML = '<h2><b></b><span></span></h2><ol></ol>';
    col.querySelector('b')!.textContent = c.label;
    col.querySelector('h2 span')!.textContent = String(c.recs.length);
    const ol = col.querySelector('ol')!;
    const render = (limit: number) => {
      ol.replaceChildren();
      for (const r of c.recs.slice(0, limit)) {
        const li = document.createElement('li');
        const s = stars.find((x) => x.r === r)!;
        li.style.setProperty('--c', `rgb(${s.rgb.join(',')})`);
        li.innerHTML = '<i></i><a></a>';
        const a = li.querySelector('a')!;
        a.href = r.href;
        a.textContent = r.title;
        if (r.lang) a.lang = r.lang;
        ol.append(li);
      }
    };
    // 人多的一栏先只列 24 个
    const LIMIT = 24;
    render(LIMIT);
    if (c.recs.length > LIMIT) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'more';
      more.textContent = `展开全部 ${c.recs.length}`;
      more.addEventListener('click', () => {
        render(Infinity);
        more.remove();
      });
      col.append(more);
    }
    roster.append(col);
  }

  // ---------- 指针 ----------
  let px = -1e4;
  let py = -1e4;
  let hover: Star | undefined;
  const onMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  };
  const onLeave = () => {
    px = py = -1e4;
  };
  const onClick = () => {
    if (hover && hover.r.href !== '#') location.href = hover.r.href;
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('click', onClick);

  const pick = (s: Star | undefined) => {
    if (s === hover) return;
    hover = s;
    stage.style.cursor = s ? 'pointer' : '';
    if (!s) {
      tip.classList.remove('on');
      titleEl.textContent = '';
      subEl.textContent = '';
      return;
    }
    tip.textContent = s.r.title;
    if (s.r.lang) tip.lang = s.r.lang;
    else tip.removeAttribute('lang');
    tip.classList.add('on');
    titleEl.textContent = s.r.title;
    if (s.r.lang) titleEl.lang = s.r.lang;
    else titleEl.removeAttribute('lang');
    subEl.textContent = `${s.r.categoryLabel}　${dateLabel(s.r.date)}`;
  };

  // ---------- 每一帧 ----------
  let raf = 0;
  const t0 = performance.now() / 1000;
  const tick = (ms: number) => {
    raf = requestAnimationFrame(tick);
    const now = ms / 1000;
    // 拖尾：不全擦掉，只盖一层半透明的底色
    // 擦掉一部分（而不是盖一层底色），星的画布保持透明，轨道细线透得出来
    sctx.globalCompositeOperation = 'destination-out';
    sctx.fillStyle = still ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.16)';
    sctx.fillRect(0, 0, W, H);
    sctx.globalCompositeOperation = 'lighter';
    // 入场：前 4 秒，每颗星从相位 0 沿着轨道走到自己的位置
    const enter = still ? 1 : Math.min(1, (now - t0) / 4);
    const ease = 1 - Math.pow(1 - enter, 3);
    let best: Star | undefined;
    let bestD = 14 * 14;
    for (const s of stars) {
      const d = ds[s.k];
      const t = ((still ? 0 : now / d.period) + s.seat.phase * ease) % 1;
      let [x, y] = at(d, t);
      x = cx + x * RX;
      y = cy + y * RY;
      if (s.seat.lanes > 1) {
        const [nx, ny] = normal(d, t);
        const off = (s.seat.lane - (s.seat.lanes - 1) / 2) * laneGap;
        x += nx * off;
        y += ny * off;
      }
      // 指针是一颗看不见的小质量：离得近的星被拉偏一点
      const dx = px - x;
      const dy = py - y;
      const dd = dx * dx + dy * dy;
      if (!still && dd < 120 * 120) {
        const pull = 0.22 * Math.exp(-dd / (2 * 45 * 45));
        x += dx * pull;
        y += dy * pull;
      }
      s.x = x;
      s.y = y;
      const hd = (px - x) ** 2 + (py - y) ** 2;
      if (hd < bestD) {
        bestD = hd;
        best = s;
      }
      const on = focus === undefined || focus === s.k;
      const tw = still ? 1 : 0.75 + 0.25 * Math.sin(now * (1.3 + s.twinkle * 2.4) + s.twinkle * 40);
      const a = (on ? 0.95 : 0.12) * tw * (0.3 + 0.7 * ease);
      const rad = focus === s.k ? 2.1 : s.seat.lanes > 4 ? 1.1 : 1.6;
      // 一圈淡淡的光晕，再一个亮的核
      sctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${(a * 0.045).toFixed(3)})`;
      sctx.beginPath();
      sctx.arc(x, y, rad * 3.2, 0, Math.PI * 2);
      sctx.fill();
      sctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${a.toFixed(3)})`;
      sctx.beginPath();
      sctx.arc(x, y, rad, 0, Math.PI * 2);
      sctx.fill();
    }
    pick(best);
    if (hover) {
      sctx.globalCompositeOperation = 'source-over';
      sctx.strokeStyle = 'rgba(255,255,255,0.9)';
      sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.arc(hover.x, hover.y, 6, 0, Math.PI * 2);
      sctx.stroke();
      tip.style.transform = `translate(${(hover.x + 12).toFixed(1)}px, ${(hover.y - 22).toFixed(1)}px)`;
    }
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
    stage.removeEventListener('click', onClick);
  };
}

/**
 * PROTOTYPE（首页第八轮 B）：光锥与世界线。
 * 单位：一年 = Y 像素（竖直），光速 c = 1，所以光锥的边是 45°，横向距离和竖向时间用同一种像素量。
 * - 正中竖线是我的世界线；最上面一点是今天，从那里画出现在的过去光锥
 * - 背景是一张光线格：过每年元旦的世界线上的点，各画两条 45° 的线
 * - 四个类别是四个方向（左二 游戏、左一 视觉小说、右一 动画、右二 音乐）；每件事是这个方向上的一个事件
 *   记得是哪天：一个点；只记得月份或年份：一段竖线，从可能的最早画到可能的最晚
 * - 指着一件事：画出它的未来光锥（从它最早可能的时刻向上）和过去光锥（从最晚可能的时刻向下），
 *   锥里的事照常，锥外的事（只是同时在别处）变淡
 */
import { dateLabel, dayOfYear, keyOrder, loadRecords, sampleMode, SVG, type Rec } from '../home-r7/r7-data';

const LANES: Rec['category'][] = ['games', 'visual-novels', 'anime', 'songs'];
const LANE_NAME: Record<Rec['category'], string> = { games: '游戏', 'visual-novels': '视觉小说', anime: '动画', songs: '音乐' };
const GLYPH: Record<Rec['category'], string> = { games: '●', 'visual-novels': '◆', anime: '○', songs: '✦' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}

function nowFY() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1).getTime();
  return d.getFullYear() + (d.getTime() - start) / (365.25 * 864e5);
}

/** 这件事可能发生的时间段（年，小数）：到日是一刻，到月是那个月，到年是那一年 */
function span(r: Rec, now: number): [number, number] {
  const d = r.date;
  // 不会有发生在现在之后的事（示意日期可能编出来，夹到现在）
  if (d.precision === 'day') {
    const t = Math.min(d.year! + dayOfYear(d), now);
    return [t, t];
  }
  if (d.precision === 'month') {
    const t = Math.min(d.year! + (d.month! - 1) / 12, now);
    return [t, Math.min(t + 1 / 12, now)];
  }
  return [Math.min(d.year!, now), Math.min(d.year! + 1, now)];
}

interface Ev {
  rec: Rec;
  x: number;
  /** 最晚可能（图上偏上）和最早可能（图上偏下）的 y */
  ya: number;
  yb: number;
  side: 'left' | 'right';
  g: SVGGElement;
  leader: SVGLineElement;
  li: HTMLLIElement;
}

export function mountWorldline(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-w]')!;
  const diagram = root.querySelector<HTMLElement>('[data-diagram]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-geo]')!;
  const list = root.querySelector<HTMLOListElement>('[data-events]')!;
  const fog = root.querySelector<HTMLUListElement>('[data-fog]')!;
  const records = loadRecords();
  const now = nowFY();
  const dated = records.filter((r) => r.date.year);
  const undated = records.filter((r) => !r.date.year).sort((a, b) => LANES.indexOf(a.category) - LANES.indexOf(b.category) || keyOrder(a.key) - keyOrder(b.key));

  // 很久以前：视界下面，一份没有坐标的名单
  fog.replaceChildren();
  for (const r of undated) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="g" aria-hidden="true"></span><a></a>';
    li.querySelector('.g')!.textContent = GLYPH[r.category];
    const a = li.querySelector('a')!;
    a.href = r.href;
    a.textContent = r.title;
    if (r.lang) a.lang = r.lang;
    fog.append(li);
  }
  root.querySelector<HTMLElement>('[data-horizon]')!.hidden = undated.length === 0;

  let events: Ev[] = [];
  let lit: Ev | undefined;
  let lightG: SVGGElement;
  let H = 0;

  const draw = () => {
    const W = diagram.clientWidth;
    const mobile = W < 600;
    const cx = W / 2;
    const half = W / 2;
    const inner = half * (mobile ? 0.1 : 0.11);
    const outer = half * (mobile ? 0.23 : 0.24);
    const laneX: Record<Rec['category'], number> = { games: cx - outer, 'visual-novels': cx - inner, anime: cx + inner, songs: cx + outer };
    const gap = mobile ? 44 : 28;

    // 一年多高：至少 base；同一侧一年里的事太多时，拉高到放得下名字
    const perYear = new Map<string, number>();
    for (const r of dated) {
      const side = laneX[r.category] < cx ? 'L' : 'R';
      const k = `${side}${r.date.year}`;
      perYear.set(k, (perYear.get(k) ?? 0) + 1);
    }
    const Y = Math.max(mobile ? 150 : 210, Math.max(0, ...perYear.values()) * gap * 1.15);
    const top = 96; // 现在
    const first = dated.length ? Math.min(...dated.map((r) => r.date.year!)) : Math.floor(now) - 2;
    const span0 = Math.max(now - first, 3);
    const yOf = (t: number) => top + (now - t) * Y;
    H = top + span0 * Y + 72;

    diagram.style.height = `${H}px`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    list.replaceChildren();

    // 光线格：过每年元旦的世界线上的点，两条 45° 线
    const nullG = el('g', {}, svg);
    const L = Math.max(W, H) * 2;
    for (let y = Math.floor(now) + Math.ceil(W / Y) + 1; y >= first - Math.ceil(W / Y) - 1; y--) {
      const yy = yOf(y);
      el('line', { x1: cx - L, y1: yy - L, x2: cx + L, y2: yy + L, class: 'null' }, nullG);
      el('line', { x1: cx - L, y1: yy + L, x2: cx + L, y2: yy - L, class: 'null' }, nullG);
    }
    // 年份：在世界线左边，元旦那一刻
    for (let y = Math.floor(now); y >= first; y--) {
      const yy = yOf(y);
      el('line', { x1: cx - 5, y1: yy, x2: cx + 5, y2: yy, class: 'year-tick' }, svg);
      const t = el('text', { x: cx - 10, y: yy - 8, class: 'year', 'text-anchor': 'end' }, svg);
      t.textContent = String(y);
    }
    // 类别方向的名字：竖写在最上面
    for (const c of LANES) {
      const t = el('text', { x: laneX[c], y: 8, class: 'lane-name', 'text-anchor': 'start' }, svg);
      t.textContent = LANE_NAME[c];
    }

    lightG = el('g', {}, svg);

    // 现在的过去光锥
    el('path', { d: `M${cx - L} ${top + L}L${cx} ${top}L${cx + L} ${top + L}`, class: 'cone-now' }, svg);
    if (!mobile) {
      const coneLabel = el('text', { class: 'cone-now-label', transform: `translate(${cx - 150} ${top + 150}) rotate(-45)`, y: -8 }, svg);
      coneLabel.textContent = '现在的过去光锥';
    }
    // 世界线
    el('line', { x1: cx, y1: top, x2: cx, y2: H, class: 'worldline' }, svg);
    el('circle', { cx, cy: top, r: 4.5, class: 'apex' }, svg);
    const nowLabel = el('text', { x: cx + 14, y: top - 22, class: 'now-label' }, svg);
    nowLabel.textContent = '现在';
    const today = new Date();
    const nowDate = el('text', { x: cx + 14, y: top - 6, class: 'now-date' }, svg);
    nowDate.textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

    // 事件
    const leaders = el('g', {}, svg);
    const seriesG = el('g', {}, svg);
    const marks = el('g', {}, svg);
    events = dated.map((rec) => {
      const [t0, t1] = span(rec, now);
      const x = laneX[rec.category];
      const ya = yOf(t1);
      const yb = yOf(t0);
      const side: Ev['side'] = x < cx ? 'left' : 'right';
      const g = el('g', { class: 'ev' }, marks);
      if (yb - ya < 1) {
        el('circle', { cx: x, cy: ya, r: rec.favorite ? 4.5 : 3.5, class: 'ev-dot' }, g);
      } else {
        el('line', { x1: x, y1: ya, x2: x, y2: yb, class: 'ev-bar' }, g);
        el('line', { x1: x - 4, y1: ya, x2: x + 4, y2: ya, class: 'ev-cap' }, g);
        el('line', { x1: x - 4, y1: yb, x2: x + 4, y2: yb, class: 'ev-cap' }, g);
      }
      if (rec.favorite) el('circle', { cx: x, cy: (ya + yb) / 2, r: 9, class: 'ev-ring' }, g);
      const leader = el('line', { class: 'leader' }, leaders);
      const li = document.createElement('li');
      li.className = `${side}${rec.favorite ? ' fav' : ''}`;
      li.innerHTML = '<a></a><span class="when"></span>';
      const a = li.querySelector('a')!;
      a.href = rec.href;
      a.textContent = rec.title;
      if (rec.lang) a.lang = rec.lang;
      li.querySelector('.when')!.textContent = dateLabel(rec.date);
      return { rec, x, ya, yb, side, g, leader, li };
    });

    // 同一系列：按时间连起来（后作总在前作的未来光锥里，同一个方向上 dx = 0）
    const bySeries = new Map<string, Ev[]>();
    for (const e of events) if (e.rec.series) bySeries.set(e.rec.series, [...(bySeries.get(e.rec.series) ?? []), e]);
    for (const group of bySeries.values()) {
      group.sort((a, b) => b.yb - a.yb);
      for (let i = 1; i < group.length; i++) {
        const a = group[i - 1];
        const b = group[i];
        el('line', { x1: a.x, y1: (a.ya + a.yb) / 2, x2: b.x, y2: (b.ya + b.yb) / 2, class: 'series' }, seriesG);
      }
    }

    // 名字：每一侧从上往下排，挤了就往下让，引线是一条「同时」的横线（被让开时会斜一点）
    const labelX = { left: cx - outer - 22, right: cx + outer + 22 };
    for (const side of ['left', 'right'] as const) {
      let prevBottom = -Infinity;
      for (const e of events.filter((v) => v.side === side).sort((a, b) => a.ya + a.yb - (b.ya + b.yb))) {
        const want = (e.ya + e.yb) / 2;
        e.li.style.left = `${labelX[side]}px`;
        e.li.style.setProperty('--max', `${Math.max(labelX.left - 12, 80)}px`);
        list.append(e.li);
        // 按名字实际的高度往下让（手机上名字会折成两三行）
        const h = e.li.offsetHeight;
        const y = Math.max(want, prevBottom + h / 2 + 6);
        prevBottom = y + h / 2;
        e.li.style.top = `${y}px`;
        const fromX = side === 'left' ? e.x - (e.rec.favorite ? 10 : 6) : e.x + (e.rec.favorite ? 10 : 6);
        e.leader.setAttribute('x1', String(fromX));
        e.leader.setAttribute('y1', String(want));
        e.leader.setAttribute('x2', String(labelX[side] + (side === 'left' ? 6 : -6)));
        e.leader.setAttribute('y2', String(y));
      }
    }
    // 读屏和 Tab 顺序：从近到远
    for (const e of [...events].sort((a, b) => a.ya - b.ya)) list.append(e.li);
    if (lit) light(events.find((e) => e.rec === lit!.rec));
  };

  // ---------- 光锥 ----------
  const light = (e: Ev | undefined) => {
    lit = e;
    lightG.replaceChildren();
    diagram.toggleAttribute('data-lit', !!e);
    for (const v of events) {
      v.g.classList.remove('here', 'elsewhere');
      v.li.classList.remove('here', 'elsewhere');
      v.leader.classList.remove('elsewhere');
    }
    if (!e) return;
    const L = H * 2;
    // 未来光锥：从最早可能的时刻（yb）向上；过去光锥：从最晚可能的时刻（ya）向下
    el('path', { d: `M${e.x} ${e.yb}L${e.x - L} ${e.yb - L}H${e.x + L}Z`, class: 'light' }, lightG);
    el('path', { d: `M${e.x} ${e.ya}L${e.x - L} ${e.ya + L}H${e.x + L}Z`, class: 'light' }, lightG);
    for (const v of events) {
      if (v === e) {
        v.g.classList.add('here');
        v.li.classList.add('here');
        continue;
      }
      const dx = Math.abs(v.x - e.x);
      const inside = e.yb - v.ya >= dx || v.yb - e.ya >= dx;
      if (!inside) {
        v.g.classList.add('elsewhere');
        v.li.classList.add('elsewhere');
        v.leader.classList.add('elsewhere');
      }
    }
  };
  const evOf = (t: EventTarget | null) => {
    const li = (t as Element | null)?.closest?.('li');
    return li ? events.find((e) => e.li === li) : undefined;
  };
  const onOver = (ev: PointerEvent) => light(evOf(ev.target));
  const onLeave = () => light(undefined);
  const onFocus = (ev: FocusEvent) => light(evOf(ev.target));
  list.addEventListener('pointerover', onOver);
  list.addEventListener('pointerleave', onLeave);
  list.addEventListener('focusin', onFocus);
  list.addEventListener('focusout', onLeave);

  let timer = 0;
  const onResize = () => {
    clearTimeout(timer);
    timer = window.setTimeout(draw, 120);
  };
  addEventListener('resize', onResize);
  draw();
  if (reduced.matches) root.dataset.still = '';
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    clearTimeout(timer);
    removeEventListener('resize', onResize);
    list.removeEventListener('pointerover', onOver);
    list.removeEventListener('pointerleave', onLeave);
    list.removeEventListener('focusin', onFocus);
    list.removeEventListener('focusout', onLeave);
  };
}

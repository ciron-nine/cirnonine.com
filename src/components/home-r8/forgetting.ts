/**
 * PROTOTYPE（首页第八轮 A）：遗忘曲线。R = e^(−t/S)：t 是完成到今天过了几年，S 是稳定性（记得有多牢）。
 * - 每个名字的 R 决定它的墨色、浓淡和字距；日期记得多准决定字的边缘有多虚
 * - 文字栏右边缘按 R 收窄（shape-outside），并画出这条曲线，在每年第一个名字旁边标上年份
 * - 指着（或在手机上点一下）一个名字：它被想起来，墨色回到新鲜的蓝黑；离开后又按指数淡回去
 *   想起来的次数记在这台设备上，下次来，它的 S 会大一点，忘得慢一点
 * - 打开页面时，所有名字先是刚写下的样子，再按各自的 R 褪下去（只这一处动画；减少动态时直接是褪好的样子）
 */
import { dateLabel, dayOfYear, keyOrder, loadRecords, sampleMode, SVG, type Rec } from '../home-r7/r7-data';

const BASE_S = 2.2; // 年：一部普通的作品，两年多以后只剩三分之一出头
const FAV_S = 2.5; // 心头好的稳定性倍数
const RECALL_S = 0.6; // 每想起一次，稳定性多这么多倍
const BLUR: Record<Rec['date']['precision'], number> = { day: 0, month: 0.7, year: 1.6, 'long-ago': 2.2 };
const MEMORY: Record<Rec['date']['precision'], string> = {
  day: '记得是哪一天',
  month: '只记得是哪个月',
  year: '只记得是哪一年',
  'long-ago': '记不清了',
};
const SEP: Record<Rec['category'], string> = { games: '●', 'visual-novels': '◆', anime: '○', songs: '✦' };
const STORE = 'r8-recalls';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function readRecalls(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}');
  } catch {
    return {};
  }
}
function writeRecalls(v: Record<string, number>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(v));
  } catch {
    /* 没有存储也照常工作，只是不记得想起过 */
  }
}

const fy = (r: Rec) => r.date.year! + dayOfYear(r.date);
function nowFY() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1).getTime();
  return d.getFullYear() + (d.getTime() - start) / (365.25 * 864e5);
}

export function mountForgetting(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-f]')!;
  const sheet = root.querySelector<HTMLElement>('[data-sheet]')!;
  const carve = root.querySelector<HTMLElement>('[data-carve]')!;
  const text = root.querySelector<HTMLElement>('[data-text]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-curve]')!;
  const note = root.querySelector<HTMLElement>('[data-recall]')!;
  const recalls = readRecalls();
  const now = nowFY();

  // 新的在前；很久以前的放最后，顺序随意但固定
  const records = loadRecords().sort((a, b) => {
    const da = a.date.year ? fy(a) : -Infinity;
    const db = b.date.year ? fy(b) : -Infinity;
    return db - da || keyOrder(a.key) - keyOrder(b.key);
  });
  const retention = (r: Rec) => {
    if (!r.date.year) return 0;
    const t = Math.max(now - fy(r), 0);
    const s = BASE_S * (r.favorite ? FAV_S : 1) * (1 + RECALL_S * (recalls[r.key] ?? 0));
    return Math.exp(-t / s);
  };

  // ---------- 写下来 ----------
  text.replaceChildren();
  const spans: HTMLAnchorElement[] = [];
  records.forEach((r, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = SEP[r.category];
      text.append(sep, ' ');
    }
    const a = document.createElement('a');
    a.className = `rec${r.favorite ? ' fav' : ''}`;
    a.href = r.href;
    a.textContent = r.title;
    if (r.lang) a.lang = r.lang;
    const R = retention(r);
    a.dataset.r = R.toFixed(4);
    a.style.setProperty('--blur', `${BLUR[r.date.precision]}px`);
    // 字距按「此刻还剩多少」定下来，回想时不变（不然整段会跟着重新排）
    a.style.letterSpacing = `${((1 - R) * (r.lang ? 0.3 : 0.24)).toFixed(3)}em`;
    a.style.setProperty('--r0', '1');
    spans.push(a);
    text.append(a, ' ');
  });

  // ---------- 曲线：文字栏的右边缘 ----------
  const mobile = () => sheet.clientWidth < 600;
  const floor = () => (mobile() ? 0.62 : 0.38);
  const frac = (R: number) => floor() + (1 - floor()) * R;

  const measure = () => {
    const top = sheet.getBoundingClientRect().top;
    return spans.map((s) => s.getClientRects()[0]?.top - top || 0);
  };

  let drawn = '';
  const layout = () => {
    // 右边留一条窄边写年份，曲线和年份都不会压到字
    const W = sheet.clientWidth - (mobile() ? 64 : 84);
    const lh = parseFloat(getComputedStyle(text).lineHeight) || 40;
    let pts: [number, number][] = [];
    // 先不挖，量一遍；然后按量到的位置挖，再量，几次就稳定了
    carve.style.height = '0';
    carve.style.shapeOutside = 'none';
    for (let k = 0; k < 4; k++) {
      const ys = measure();
      let min = 1;
      pts = [[W, 0]];
      spans.forEach((s, i) => {
        min = Math.min(min, frac(Number(s.dataset.r)));
        pts.push([W * min, Math.max(ys[i] - lh * 0.15, 0)]);
      });
      // 挖得比文字长一截，免得最后几行掉到挖口下面变回整行宽
      const H = (text.offsetHeight + lh) * 1.5;
      pts.push([W * min, H]);
      carve.style.height = `${H}px`;
      carve.style.shapeOutside = `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')}, ${sheet.clientWidth}px ${H}px, ${sheet.clientWidth}px 0)`;
    }
    // 最后一段是竖直的（渐近线），截短到文字底下不会改变任何一行
    const Hf = text.offsetHeight;
    pts[pts.length - 1][1] = Hf;
    carve.style.height = `${Hf}px`;
    carve.style.shapeOutside = `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')}, ${sheet.clientWidth}px ${Hf}px, ${sheet.clientWidth}px 0)`;
    // 画线：同一行的点只取第一个，连成平滑的曲线
    const ys = measure();
    const line: [number, number][] = [];
    for (const p of pts) if (!line.length || p[1] - line[line.length - 1][1] > 4) line.push(p);
    const key = `${W}|${line.map((p) => p.join(',')).join(';')}`;
    if (key === drawn) return;
    drawn = key;
    svg.replaceChildren();
    const d = line.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + 14).toFixed(1)} ${y.toFixed(1)}`).join('');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'line');
    svg.append(path);
    // 每年第一个名字旁边写上年份；很久以前写一次
    let lastYear: number | undefined | null = null;
    let lastY = -Infinity;
    spans.forEach((_, i) => {
      const r = records[i];
      const y = r.date.year;
      if (y === lastYear) return;
      lastYear = y;
      const yy = ys[i] + lh * 0.55;
      // 同一行里换了好几年的，只标第一年（很久以前总要标出来）
      if (yy - lastY < 20 && y) return;
      lastY = yy;
      const x = Math.min(W * frac(Math.min(...spans.slice(0, i + 1).map((t) => Number(t.dataset.r)))) + 14, W);
      const tick = document.createElementNS(SVG, 'line');
      tick.setAttribute('class', 'tick');
      tick.setAttribute('x1', String(x - 4));
      tick.setAttribute('x2', String(x + 4));
      tick.setAttribute('y1', String(yy - 4));
      tick.setAttribute('y2', String(yy - 4));
      const label = document.createElementNS(SVG, 'text');
      label.setAttribute('class', `yr${y ? '' : ' voice'}`);
      label.setAttribute('x', String(x + 10));
      label.setAttribute('y', String(yy));
      label.textContent = y ? String(y) : '很久以前';
      svg.append(tick, label);
    });
  };

  // ---------- 想起来 ----------
  let dwell = 0;
  const showNote = (a: HTMLAnchorElement) => {
    const r = records[spans.indexOf(a)];
    const n = recalls[r.key] ?? 0;
    note.textContent = `${dateLabel(r.date)}　${MEMORY[r.date.precision]}${n ? `　想起来过 ${n} 次` : ''}`;
    const sr = sheet.getBoundingClientRect();
    const ar = a.getClientRects()[0] ?? a.getBoundingClientRect();
    note.style.left = `${Math.min(ar.left - sr.left, sheet.clientWidth - 240)}px`;
    note.style.top = `${ar.bottom - sr.top + 2}px`;
    note.classList.add('on');
  };
  const recall = (a: HTMLAnchorElement) => {
    for (const s of spans) if (s !== a) forget(s);
    a.classList.add('recalling');
    showNote(a);
    clearTimeout(dwell);
    // 停够一会儿才算真的想起来了一次
    dwell = window.setTimeout(() => {
      const key = records[spans.indexOf(a)].key;
      recalls[key] = (recalls[key] ?? 0) + 1;
      writeRecalls(recalls);
      showNote(a);
    }, 1200);
  };
  const forget = (a: HTMLAnchorElement) => {
    if (!a.classList.contains('recalling')) return;
    a.classList.remove('recalling');
    delete a.dataset.armed;
    clearTimeout(dwell);
    note.classList.remove('on');
  };
  const target = (e: Event) => (e.target as Element).closest?.<HTMLAnchorElement>('a.rec') ?? null;
  let touch = false;
  const onOver = (e: PointerEvent) => {
    const a = target(e);
    if (a && e.pointerType !== 'touch') recall(a);
  };
  const onOut = (e: PointerEvent) => {
    const a = target(e);
    if (a && e.pointerType !== 'touch' && !a.contains(e.relatedTarget as Node)) forget(a);
  };
  const onDown = (e: PointerEvent) => {
    touch = e.pointerType === 'touch';
  };
  // 手机上：第一下是想起来，第二下才打开
  const onClick = (e: MouseEvent) => {
    const a = target(e);
    if (!a || !touch) return;
    if (!a.dataset.armed) {
      e.preventDefault();
      recall(a);
      a.dataset.armed = '1';
    }
  };
  const onFocus = (e: FocusEvent) => {
    const a = target(e);
    if (a) recall(a);
  };
  const onBlur = (e: FocusEvent) => {
    const a = target(e);
    if (a) forget(a);
  };
  text.addEventListener('pointerover', onOver);
  text.addEventListener('pointerout', onOut);
  text.addEventListener('pointerdown', onDown);
  text.addEventListener('click', onClick);
  text.addEventListener('focusin', onFocus);
  text.addEventListener('focusout', onBlur);

  // ---------- 打开时：先是刚写下的样子，再按各自的 R 褪下去 ----------
  const settle = (animate: boolean) => {
    spans.forEach((s, i) => {
      s.style.setProperty('--delay', animate ? `${(0.4 + Math.min(i * 0.04, 1.4)).toFixed(2)}s` : '0s');
      if (!animate) s.style.transition = 'none';
      s.style.setProperty('--r0', s.dataset.r!);
    });
    if (!animate) requestAnimationFrame(() => spans.forEach((s) => (s.style.transition = '')));
    // 动画结束后清掉延迟，回想和遗忘都立刻开始
    setTimeout(() => spans.forEach((s) => s.style.setProperty('--delay', '0s')), animate ? 7000 : 0);
  };

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  };
  addEventListener('resize', onResize);
  layout();
  let alive = true;
  document.fonts.ready.then(() => {
    if (!alive) return;
    layout();
    requestAnimationFrame(() => settle(!reduced.matches));
  });
  // 字体切片是按需加载的，晚到的字会改变行宽，再排一次
  const onFonts = () => alive && layout();
  document.fonts.addEventListener('loadingdone', onFonts);
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    alive = false;
    clearTimeout(dwell);
    clearTimeout(resizeTimer);
    removeEventListener('resize', onResize);
    document.fonts.removeEventListener('loadingdone', onFonts);
    text.removeEventListener('pointerover', onOver);
    text.removeEventListener('pointerout', onOut);
    text.removeEventListener('pointerdown', onDown);
    text.removeEventListener('click', onClick);
    text.removeEventListener('focusin', onFocus);
    text.removeEventListener('focusout', onBlur);
  };
}

/**
 * PROTOTYPE（首页第七轮 A）：活动星盘。
 * 盘面：外圈是十二个月的日期环；往里一年一圈（越近越靠外），最中心的轴心是「很久以前」。
 * 星：角度是一年里的哪一天，在它那一年的圈上；到月、到年的记录拖着一段弧，弧长就是记不清的那段时间。
 * 指针：朱色，固定不动。转动星盘（拖、滚轮、方向键、按钮）就是在一年里来回；
 * 指针对准的日期读在右上，下面列出「这一天前后」不同年份里完成的记录。打开时星盘从一月一日转到今天。
 */
import { dateLabel, dayOfYear, el, glyph, keyOrder, loadRecords, sampleMode, uncertainty, type Rec } from './r7-data';

const POINTER = -128; // 指针的方向（度，0 是三点钟，顺时针为正）：斜向左上
const R_DATE = 460;
const R_HUB = 92;
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r] as const;
/** 一年里的位置 0..1 → 盘面上的角度（一月一日在正上方，顺时针） */
const angleOf = (t: number) => -90 + t * 360;

function arc(r: number, a0: number, a1: number) {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

export function mountPlanisphere(root: HTMLElement): () => void {
  const svg = root.querySelector<SVGSVGElement>('[data-wheel]')!;
  const readDate = root.querySelector<HTMLElement>('[data-read-date]')!;
  const readList = root.querySelector<HTMLOListElement>('[data-read-list]')!;
  const records = loadRecords();
  svg.replaceChildren();

  const years = [...new Set(records.filter((r) => r.date.year).map((r) => r.date.year!))].sort((a, b) => b - a);
  const ringR = (year: number) => {
    const i = years.indexOf(year);
    return years.length < 2 ? 300 : 420 - (i / (years.length - 1)) * (420 - R_HUB - 40);
  };

  // ---------- 转动的盘面 ----------
  const wheel = el('g', { class: 'wheel' }, svg);
  el('circle', { r: 480, class: 'disc' }, wheel);
  el('circle', { r: R_DATE - 22, class: 'rule' }, wheel);
  // 日期环：每天一道小刻度，每五天长一点，月界最长；月名沿着圆写
  const defs = el('defs', {}, svg);
  for (let d = 0; d < 365; d++) {
    const a = angleOf(d / 365);
    const monthStart = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334].includes(d);
    const len = monthStart ? 22 : d % 5 === 0 ? 8 : 4;
    const [x0, y0] = polar(a, R_DATE - 22);
    const [x1, y1] = polar(a, R_DATE - 22 + len);
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: monthStart ? 'tick month' : 'tick' }, wheel);
  }
  MONTHS.forEach((m, i) => {
    const a0 = angleOf(i / 12) + 3;
    const a1 = angleOf((i + 1) / 12) - 3;
    const id = `month-path-${i}`;
    el('path', { id, d: arc(R_DATE - 4, a0, a1) }, defs);
    const text = el('text', { class: 'month-name' }, wheel);
    const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, text);
    tp.textContent = m;
  });
  // 一年一圈
  for (const y of years) el('circle', { r: ringR(y), class: 'year-ring' }, wheel);
  // 轴心：很久以前
  el('circle', { r: R_HUB, class: 'hub' }, wheel);
  el('path', { id: 'hub-path', d: arc(R_HUB + 12, 200, 340) }, defs);
  const hubText = el('text', { class: 'hub-name' }, wheel);
  const hubTp = el('textPath', { href: '#hub-path', startOffset: '50%', 'text-anchor': 'middle' }, hubText);
  hubTp.textContent = '很久以前';

  // 星
  const starEls = new Map<Rec, SVGGElement>();
  for (const r of records) {
    const g = el('a', { href: r.href, class: `star${r.favorite ? ' fav' : ''}`, 'aria-label': r.title, tabindex: -1 }, wheel) as unknown as SVGGElement;
    if (r.date.precision === 'long-ago') {
      // 轴心里随便散着，很淡
      const a = keyOrder(r.key) * 360;
      const rr = Math.sqrt(keyOrder(r.key + 'r')) * (R_HUB - 10);
      const [x, y] = polar(a, rr);
      glyph(r.category, x, y, 2.4, g).classList.add('faded');
    } else {
      const t = r.date.precision === 'year' ? keyOrder(r.key) : dayOfYear(r.date);
      const a = angleOf(t);
      const R = ringR(r.date.year!);
      const u = uncertainty(r.date);
      if (u > 0) {
        // 记不清的那段时间：沿着这一年的圈拖一段弧，到年的拖四分之一圈（再长就看不出是一颗星了）
        const span = Math.min(u, 0.25) * 360;
        el('path', { d: arc(R, a - span / 2, a + span / 2), class: `smear ${r.date.precision}` }, g);
      }
      const [x, y] = polar(a, R);
      glyph(r.category, x, y, r.favorite ? 5 : 3.6, g);
    }
    starEls.set(r, g);
  }

  // ---------- 不转的：指针和年份 ----------
  const fixed = el('g', { class: 'fixed' }, svg);
  const [px, py] = polar(POINTER, 520);
  el('line', { x1: 0, y1: 0, x2: px, y2: py, class: 'pointer' }, fixed);
  for (const y of years) {
    const [x, yy] = polar(POINTER, ringR(y));
    el('circle', { cx: x, cy: yy, r: 2.2, class: 'pointer-dot' }, fixed);
    const label = el('text', { x: x + 8, y: yy - 6, class: 'year-label' }, fixed);
    label.textContent = String(y);
  }
  el('circle', { r: 4, class: 'rivet' }, fixed);

  // ---------- 转动 ----------
  let t = 0; // 指针对准一年里的哪里（0..1）
  let shown = t;
  let raf = 0;
  const render = () => {
    const rot = POINTER - angleOf(shown);
    wheel.setAttribute('transform', `rotate(${rot.toFixed(3)})`);
  };
  const readout = () => {
    const days = Math.round(((t % 1) + 1) % 1 * 365);
    const date = new Date(2001, 0, 1 + days);
    readDate.textContent = `${date.getMonth() + 1} · ${date.getDate()}`;
    // 这一天前后十五天，不同年份里完成的
    const near = records
      .filter((r) => r.date.precision === 'day' || r.date.precision === 'month')
      .map((r) => {
        let d = dayOfYear(r.date) - (((t % 1) + 1) % 1);
        d -= Math.round(d);
        return { r, d: Math.abs(d) };
      })
      .filter((x) => x.d < 15 / 365)
      .sort((a, b) => b.r.date.year! - a.r.date.year!);
    readList.replaceChildren(
      ...near.map(({ r }) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="when voice"></span><a></a>`;
        li.querySelector('.when')!.textContent = dateLabel(r.date);
        const a = li.querySelector('a')!;
        a.href = r.href;
        a.textContent = r.title;
        if (r.lang) a.lang = r.lang;
        return li;
      }),
    );
    if (near.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty voice';
      li.textContent = '这几天前后，还没有记下什么。';
      readList.append(li);
    }
    for (const [r, g] of starEls) {
      const on = near.some((x) => x.r === r);
      g.classList.toggle('lit', on);
    }
  };
  const loop = () => {
    raf = 0;
    shown += (t - shown) * 0.12;
    render();
    if (Math.abs(t - shown) > 1e-4) raf = requestAnimationFrame(loop);
    else {
      shown = t;
      render();
    }
  };
  const go = (next: number) => {
    t = next;
    readout();
    if (reduced.matches) {
      shown = t;
      render();
    } else raf ||= requestAnimationFrame(loop);
  };

  const today = new Date();
  const todayT = (today.getMonth() * 30.44 + today.getDate() - 0.5) / 365.25;
  render();
  // 打开时从一月一日转到今天
  if (reduced.matches) go(todayT);
  else setTimeout(() => go(todayT), 300);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    go(t + e.deltaY / 365 / 12);
  };
  let drag: { a: number; t: number } | undefined;
  const pointerAngle = (e: PointerEvent) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return (Math.atan2(p.y, p.x) * 180) / Math.PI;
  };
  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('a')) return;
    drag = { a: pointerAngle(e), t };
    svg.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    let da = pointerAngle(e) - drag.a;
    da -= Math.round(da / 360) * 360;
    // 顺着转星盘，指针下的日期往前退
    go(drag.t - da / 360);
  };
  const onUp = () => (drag = undefined);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(t - 7 / 365);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(t + 7 / 365);
    else return;
    e.preventDefault();
  };
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('keydown', onKey);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-turn]')];
  const onButton = (e: Event) => {
    const kind = (e.currentTarget as HTMLElement).dataset.turn;
    go(kind === 'today' ? todayT + Math.round(t - todayT) : t + (kind === 'next' ? 1 : -1) / 12);
  };
  buttons.forEach((b) => b.addEventListener('click', onButton));
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    cancelAnimationFrame(raf);
    svg.removeEventListener('wheel', onWheel);
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('keydown', onKey);
    buttons.forEach((b) => b.removeEventListener('click', onButton));
  };
}

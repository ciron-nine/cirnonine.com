/**
 * PROTOTYPE（首页第七轮 C）：回望。看得越远，看到的光越早——记录也一样。
 * 页面最上面是现在（白纸），往下一年一层，越往下纸色越暗，最后是夜；最底下是「很久以前」，一片柔和的光。
 * 每一层：大大的年份，星按月份横着排开，越早的年份星越小、越淡；记得不准的星是虚的（到月微虚，到年更虚）。
 * 右边是年份的索引，可以直接跳过去；滚动时当前那一年用朱色标出。
 */
import { dateLabel, dayOfYear, keyOrder, loadRecords, sampleMode, type Rec } from './r7-data';

const GLYPH: Record<Rec['category'], string> = { games: '●', 'visual-novels': '◆', anime: '○', songs: '✦' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/** 天色的几个停靠点：越往下越像入夜 */
const SKY: [number, [number, number, number]][] = [
  [0, [238, 240, 242]],
  [0.28, [196, 203, 216]],
  [0.5, [74, 86, 116]],
  [0.75, [24, 29, 44]],
  [1, [11, 13, 18]],
];
function sky(f: number): string {
  for (let i = 1; i < SKY.length; i++) {
    const [t1, c1] = SKY[i];
    const [t0, c0] = SKY[i - 1];
    if (f <= t1) {
      const k = (f - t0) / (t1 - t0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(' ')})`;
    }
  }
  return 'rgb(11 13 18)';
}

export function mountLookback(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-c]')!;
  const layers = root.querySelector<HTMLElement>('[data-layers]')!;
  const rail = root.querySelector<HTMLOListElement>('[data-rail]')!;
  const records = loadRecords();
  layers.replaceChildren();
  rail.replaceChildren();

  const years = [...new Set(records.filter((r) => r.date.year).map((r) => r.date.year!))].sort((a, b) => b - a);
  const groups: { id: string; label: string; recs: Rec[]; depth: number }[] = years.map((y, i) => ({
    id: `y${y}`,
    label: String(y),
    recs: records.filter((r) => r.date.year === y),
    depth: (i + 1) / (years.length + 1),
  }));
  groups.push({ id: 'long-ago', label: '很久以前', recs: records.filter((r) => r.date.precision === 'long-ago'), depth: 1 });

  for (const g of groups) {
    const section = document.createElement('section');
    section.className = g.id === 'long-ago' ? 'layer long-ago' : 'layer';
    section.id = g.id;
    section.style.setProperty('--d', g.depth.toFixed(3));
    const h = document.createElement('h2');
    h.className = 'year';
    h.textContent = g.label;
    section.append(h);
    const field = document.createElement('ol');
    field.className = 'field';
    // 同一年里横向位置相近的记录错开成几行，免得叠在一起
    const placed: { x: number; row: number }[] = [];
    const xOf = (r: Rec) =>
      g.id === 'long-ago' ? keyOrder(r.key) : r.date.precision === 'year' ? 0.08 + keyOrder(r.key) * 0.84 : dayOfYear(r.date);
    const sorted = [...g.recs].sort((a, b) => xOf(a) - xOf(b));
    let rows = 1;
    for (const r of sorted) {
      const li = document.createElement('li');
      li.className = `rec ${r.date.precision}${r.favorite ? ' fav' : ''}`;
      // 横向是一年里的位置；纵向找第一行不和别人挤在一起的
      const x = xOf(r);
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.x - x) < 0.16)) row++;
      placed.push({ x, row });
      rows = Math.max(rows, row + 1);
      li.style.setProperty('--x', x.toFixed(4));
      li.style.setProperty('--row', String(row));
      li.innerHTML = '<span class="g" aria-hidden="true"></span><a></a><span class="when voice"></span>';
      li.querySelector('.g')!.textContent = GLYPH[r.category];
      const a = li.querySelector('a')!;
      a.href = r.href;
      a.textContent = r.title;
      if (r.lang) a.lang = r.lang;
      li.querySelector('.when')!.textContent = dateLabel(r.date);
      field.append(li);
    }
    field.style.setProperty('--rows', String(rows));
    section.append(field);
    layers.append(section);

    const item = document.createElement('li');
    item.innerHTML = '<a></a>';
    const link = item.querySelector('a')!;
    link.href = `#${g.id}`;
    link.textContent = g.label;
    link.dataset.target = g.id;
    rail.append(item);
  }

  // 越往下越暗：按滚动位置给 --depth（0 是白纸，1 是夜）
  let raf = 0;
  const sections = [...layers.querySelectorAll<HTMLElement>('.layer')];
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const f = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
    root.style.setProperty('--depth', f.toFixed(4));
    // 天色：白纸 → 傍晚的淡蓝灰 → 蓝调时刻 → 夜；字在天色过半时由深转浅
    root.style.setProperty('--bg', sky(f));
    root.style.setProperty('--fg', f < 0.42 ? '#14161c' : '#e8eaee');
    // 当前那一年
    let current = sections[0]?.id;
    for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.5) current = s.id;
    for (const a of rail.querySelectorAll<HTMLAnchorElement>('a')) a.toggleAttribute('aria-current', a.dataset.target === current);
  };
  const onScroll = () => {
    raf ||= requestAnimationFrame(update);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
  if (reduced.matches) root.dataset.still = '';
  if (sampleMode()) root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    cancelAnimationFrame(raf);
    root.style.removeProperty('--depth');
    root.style.removeProperty('--bg');
    root.style.removeProperty('--fg');
  };
}

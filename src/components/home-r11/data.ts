/**
 * PROTOTYPE（首页第十一轮）：光谱型。读数据岛，给每条记录定光谱型。
 *
 * 1901 年起，哈佛天文台的 Annie Jump Cannon 按光谱给几十万颗星分了类：O B A F G K M，从热到冷。
 * 这个分法不比亮暗、不比远近，只说一颗星是什么样的光。这一页也一样：一条记录的光，就是它封面的主色
 * （「作品的声音」，ADR-0005）。按它的冷暖投到黑体轨迹上求出色温，落在哪一型，星就是那一型的颜色。
 * 不看完成的先后，不看心头好，也不看我写了多少。
 *
 * ?sample=1 时给每条记录编一个示意的封面主色（现在的封面都是占位图，真实数据里所有星同一个颜色），页面上会标出来。
 */
import { blackbodyHex, cct, classify, type SpectralClass } from './spectrum';

export type Precision = 'day' | 'month' | 'year' | 'long-ago';
export type Category = 'games' | 'visual-novels' | 'anime' | 'songs';
export interface CDate {
  precision: Precision;
  year?: number;
  month?: number;
  day?: number;
}
export interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: Category;
  categoryLabel: string;
  favorite: boolean;
  series?: string;
  date: CDate;
  coverColor?: string;
}
export interface Entry extends Rec {
  /** 封面主色（示意模式下是编的） */
  cover: string;
  /** 相关色温，K */
  T: number;
  cls: SpectralClass;
  sub: number;
  /** 例如 G2 */
  type: string;
  /** 星画成的颜色：那个温度的黑体本身的颜色 */
  star: string;
}

export const sampleMode = () => new URL(location.href).searchParams.get('sample') === '1';

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

/** 示意的封面主色：随便一种色相，饱和度、明度都取封面常见的范围 */
function sampleCover(key: string): string {
  const h = hash(key + 'h') * 360;
  const s = 0.2 + hash(key + 's') * 0.6;
  const l = 0.22 + hash(key + 'l') * 0.5;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** 没有封面的记录：一张白纸的颜色（D65，约 6500 K，F 型） */
const NO_COVER = '#ffffff';

export function loadEntries(): Entry[] {
  const raw: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  const sample = sampleMode();
  return raw.map((r) => {
    const cover = sample ? sampleCover(r.key) : (r.coverColor ?? NO_COVER);
    const T = cct(cover);
    const { cls, sub, label } = classify(T);
    return { ...r, cover, T, cls, sub, type: label, star: blackbodyHex(T) };
  });
}

export function dateLabel(d: CDate): string {
  if (d.precision === 'day') return `${d.year}年${d.month}月${d.day}日`;
  if (d.precision === 'month') return `${d.year}年${d.month}月`;
  if (d.precision === 'year') return `${d.year}年`;
  return '很久以前';
}

export const kelvin = (T: number) => `${Math.round(T / 10) * 10} K`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

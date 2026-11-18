/**
 * PROTOTYPE（首页第十三轮）：灯质。
 *
 * 夜里看见远处一点光，水手靠它怎么闪认出是哪一座灯塔：每座灯都有自己的「灯质」，印在海图和灯标表上，
 * 写法是国际航标协会（IALA）统一的：
 *   Fl(3) W 12s  每 12 秒闪 3 下，白光（闪：亮的时间比暗短）
 *   Oc(2) R 8s   每 8 秒暗 2 下，红光（明暗：亮的时间比暗长）
 *   Iso G 4s     亮暗一样长，一个周期 4 秒
 *   Mo(K) Y 10s  用摩尔斯电码闪一个字母
 * 每条记录是一盏灯，灯质全由作品自己的资料定，不看年代，也不分高低——就像灯塔之间只有不同，没有谁更重要：
 *   闪法：按类别（游戏 Fl、视觉小说 Oc、动画 Iso、音乐 Mo）
 *   组数：原名有几个字（取 1–4）
 *   周期：组数撑开的最短周期，再按原名的散列多出几秒
 *   灯色：封面主色归到最近的那种灯色（白、红、绿、黄）；摩尔斯的字母取原名里第一个拉丁字母
 */

export type Kind = 'Fl' | 'Oc' | 'Iso' | 'Mo';
export type LightColor = 'W' | 'R' | 'G' | 'Y';

export interface Characteristic {
  kind: Kind;
  group: number;
  letter?: string;
  color: LightColor;
  period: number;
  /** 一个周期里亮着的时间段（秒） */
  on: [number, number][];
  /** 例如 Fl(3) W 12s */
  label: string;
}

export const KIND_OF: Record<string, Kind> = { games: 'Fl', 'visual-novels': 'Oc', anime: 'Iso', songs: 'Mo' };
export const KIND_NAME: Record<Kind, string> = { Fl: '闪光', Oc: '明暗', Iso: '等明暗', Mo: '摩尔斯' };
export const COLOR_HEX: Record<LightColor, string> = { W: '#fff3d6', R: '#ff5b4d', G: '#4de08c', Y: '#ffd04a' };
export const COLOR_NAME: Record<LightColor, string> = { W: '白', R: '红', G: '绿', Y: '黄' };

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

/** 封面主色 → 最近的灯色：很亮又不鲜艳的是白光，其余按色相 */
export function lightColor(hex: string | undefined): LightColor {
  if (!hex) return 'W';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const s = max === 0 ? 0 : (max - min) / max;
  if (s < 0.28) return 'W';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h *= 60;
  if (h < 25 || h >= 300) return 'R';
  if (h < 70) return 'Y';
  if (h < 190) return 'G';
  return 'W';
}

export function characteristic(category: string, title: string, cover: string | undefined, key: string): Characteristic {
  const kind = KIND_OF[category] ?? 'Fl';
  const chars = [...title.replace(/\s+/g, '')].length;
  const group = 1 + ((chars - 1) % 4);
  const color = lightColor(cover);
  const extra = Math.floor(hash(key + 'period') * 5);
  const on: [number, number][] = [];
  let period = 0;
  let letter: string | undefined;
  let label = '';
  if (kind === 'Fl') {
    // 一闪 0.5 秒，组内间隔 1 秒，组后留长一点的暗
    for (let i = 0; i < group; i++) on.push([i * 1.5, i * 1.5 + 0.5]);
    period = Math.ceil(Math.max(group * 1.5 + 2.5, 3)) + extra;
    label = `Fl${group > 1 ? `(${group})` : ''} ${color} ${period}s`;
  } else if (kind === 'Oc') {
    // 长亮，暗 0.8 秒一次
    const dark: [number, number][] = [];
    for (let i = 0; i < group; i++) dark.push([i * 1.8, i * 1.8 + 0.8]);
    period = Math.ceil(Math.max(group * 1.8 + 3, 4)) + extra;
    let t = 0;
    for (const [a, b] of dark) {
      if (a > t) on.push([t, a]);
      t = b;
    }
    on.push([t, period]);
    label = `Oc${group > 1 ? `(${group})` : ''} ${color} ${period}s`;
  } else if (kind === 'Iso') {
    period = 2 * (1 + Math.floor(hash(key + 'iso') * 4));
    on.push([0, period / 2]);
    label = `Iso ${color} ${period}s`;
  } else {
    const latin = title.toUpperCase().match(/[A-Z]/)?.[0] ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(hash(key + 'mo') * 26)];
    letter = latin;
    let t = 0;
    for (const c of MORSE[latin]) {
      const len = c === '.' ? 0.5 : 1.5;
      on.push([t, t + len]);
      t += len + 0.5;
    }
    period = Math.max(Math.ceil(t + 4), 8) + extra;
    label = `Mo(${latin}) ${color} ${period}s`;
  }
  return { kind, group, letter, color, period, on, label };
}

/** 这一刻亮不亮：0..1（边缘柔一点，像真的灯丝和透镜） */
export function brightness(c: Characteristic, t: number): number {
  const x = ((t % c.period) + c.period) % c.period;
  let v = 0;
  for (const [a, b] of c.on) {
    if (x >= a && x < b) {
      const edge = 0.12;
      v = Math.max(v, Math.min(1, (x - a) / edge, (b - x) / edge));
    }
  }
  return v;
}

/**
 * PROTOTYPE（首页第十五轮）：编舞轨道。只放几何，不碰页面。
 *
 * 三体问题一般是乱的。1993 年摩尔用计算机找到一个奇迹般的解：三颗一样重的星在同一条「8」字形轨道上一前一后追逐，
 * 永不相撞、永不散开；2000 年申西纳和蒙哥马利证明了它存在。同年西莫找到了几百个这样的解——n 颗星共用一条闭合曲线——
 * 给它们起名叫「编舞」（choreography）。数值上找到的编舞，很多形状接近利萨如曲线（x = sin(a·t + φ)，y = sin(b·t)），
 * 「8」字就接近 1:2 的那一条；日本的藤原、福田、尾崎等人专门研究过这一族「利萨如编舞」。
 *
 * 这一页：一个类别是一支舞，形状依次取 1:2、2:3、3:4、3:5、4:5……类别再多也有下一条；
 * 作品是这支舞里的星，在同一条轨道上等相位地追逐。星多的时候分成并排的几条「跑道」，
 * 所以十几颗是一串珠子，上千颗是一条流动的光带；轨道大小都一样，多的不会压住少的。
 * 星走得快慢跟着曲线自己来：转弯的地方慢、交叉的地方快，就像真的星在引力里。
 */

export interface Dance {
  a: number;
  b: number;
  phi: number;
  /** 整支舞转一个角度 */
  rot: number;
  /** 大小：几支舞一层套一层，外面的大、里面的小，同一个中心、同一条对称轴 */
  scale: number;
  /** 绕一圈要多少秒 */
  period: number;
}

/** 利萨如编舞的一族：从简单到复杂，a、b 互质 */
const FAMILY: [number, number][] = [
  [1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [4, 7], [5, 6], [5, 7], [5, 8], [6, 7], [7, 8], [7, 9],
];

export function dances(count: number): Dance[] {
  return Array.from({ length: count }, (_, k) => {
    const [a, b] = FAMILY[k % FAMILY.length];
    return {
      a,
      b,
      // 1:2 取相位 0 才是「8」字；其余取 π/2b，避开退化成一条线的相位
      phi: a === 1 && b === 2 ? 0 : Math.PI / 2 / b,
      rot: 0,
      scale: count > 1 ? 1 - (k / (count - 1)) * 0.5 : 1,
      // 复杂的舞跳得慢一点，免得眼花
      period: 26 + (a + b) * 5,
    };
  });
}

/** 一支舞上相位 t（0..1）那一点：单位坐标（大致在 −1..1） */
export function at(d: Dance, t: number): [number, number] {
  const s = t * Math.PI * 2;
  const x = Math.sin(d.a * s + d.phi);
  const y = Math.sin(d.b * s);
  const c = Math.cos(d.rot);
  const n = Math.sin(d.rot);
  return [(x * c - y * n) * d.scale, (x * n + y * c) * d.scale];
}

/** 那一点的法线（给并排的跑道往旁边让） */
export function normal(d: Dance, t: number): [number, number] {
  const e = 1e-4;
  const [x0, y0] = at(d, t - e);
  const [x1, y1] = at(d, t + e);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

/** 每条跑道最多多少颗星；再多就加一条跑道 */
export const PER_LANE = 40;

export interface Seat {
  lane: number;
  lanes: number;
  /** 在这支舞里的起始相位 */
  phase: number;
}

/** n 颗星怎么坐：分成几条跑道，每条跑道上等间隔，跑道之间错开半格 */
export function seats(n: number): Seat[] {
  const lanes = Math.max(1, Math.ceil(n / PER_LANE));
  const perLane = Math.ceil(n / lanes);
  return Array.from({ length: n }, (_, i) => {
    const lane = i % lanes;
    const j = Math.floor(i / lanes);
    // 跑道之间按黄金比错开，不排成一列列的条纹
    return { lane, lanes, phase: (j + ((lane * 0.618034) % 1)) / perLane };
  });
}

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

/**
 * PROTOTYPE（首页第十二轮）：克拉尼图形的物理。只放数，不碰页面。
 *
 * 1787 年克拉尼在金属板上撒沙，用琴弓拉板边：板子振动，沙子从振得厉害的地方跳开，聚到不动的线（节线）上。
 * 方板（四边自由）的振动模式取一个近似：
 *   A(x, y) = cos(nπx)·cos(mπy) ± cos(mπx)·cos(nπy)，x、y ∈ [0, 1]
 * A = 0 的地方就是节线。频率按板的规律随 m² + n² 增长（克拉尼自己总结过类似的经验律）。
 * 沙子的动法也照真的来：每粒沙每一帧按它脚下振得多厉害被随机地弹一下（|A| 越大跳得越远），
 * 再顺着 A² 往下滑一点；振动停了，摩擦让它停在原地。于是沙子自己「走」到节线上。
 */

export interface Mode {
  m: number;
  n: number;
  /** 两个驻波相加还是相减：同一对 (m, n) 的两种花纹 */
  sign: 1 | -1;
}

/** 拉弓时，沿板边依次能拉出来的模式（从简单到复杂） */
export const MODES: Mode[] = [
  { m: 1, n: 2, sign: 1 },
  { m: 1, n: 3, sign: -1 },
  { m: 2, n: 3, sign: 1 },
  { m: 1, n: 4, sign: -1 },
  { m: 2, n: 5, sign: 1 },
  { m: 3, n: 4, sign: -1 },
  { m: 1, n: 5, sign: 1 },
  { m: 3, n: 5, sign: -1 },
  { m: 2, n: 7, sign: 1 },
  { m: 4, n: 5, sign: 1 },
  { m: 3, n: 7, sign: -1 },
  { m: 4, n: 7, sign: 1 },
  { m: 5, n: 6, sign: -1 },
  { m: 5, n: 8, sign: 1 },
];

/** 四个类别各是一种模式：点类别名，板子换到这个频率 */
export const CATEGORY_MODE: Record<string, Mode> = {
  games: { m: 2, n: 5, sign: 1 },
  'visual-novels': { m: 3, n: 5, sign: -1 },
  anime: { m: 4, n: 7, sign: 1 },
  songs: { m: 1, n: 4, sign: -1 },
};

/** 频率（Hz）：随 m² + n² 增长，压到好听的音域里（最简单的 (1,2) 约 86 Hz，(5,8) 约 1,220 Hz） */
export const frequency = (mode: Mode) => 19.6 * (mode.m ** 2 + mode.n ** 2) ** 0.92 * (mode.sign > 0 ? 1 : 1.012);

export const modeLabel = (mode: Mode) => `(${mode.m}, ${mode.n})`;

const PI = Math.PI;

/** 振幅和它的梯度 */
export function field(mode: Mode, x: number, y: number): [number, number, number] {
  const { m, n, sign } = mode;
  const cnx = Math.cos(n * PI * x);
  const cmy = Math.cos(m * PI * y);
  const cmx = Math.cos(m * PI * x);
  const cny = Math.cos(n * PI * y);
  const snx = Math.sin(n * PI * x);
  const smy = Math.sin(m * PI * y);
  const smx = Math.sin(m * PI * x);
  const sny = Math.sin(n * PI * y);
  const a = cnx * cmy + sign * cmx * cny;
  const ax = -n * PI * snx * cmy - sign * m * PI * smx * cny;
  const ay = -m * PI * cnx * smy - sign * n * PI * cmx * sny;
  return [a, ax, ay];
}

export interface Grains {
  x: Float32Array;
  y: Float32Array;
}

export function scatter(count: number, rand: () => number): Grains {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = rand();
    y[i] = rand();
  }
  return { x, y };
}

/**
 * 走一步。energy 是板子此刻振得多厉害（0..1）。
 * 弹跳：步长 ∝ energy·|A|；下滑：顺着 −∇(A²)；四边是板沿，沙子出不去。
 */
export function step(g: Grains, mode: Mode, energy: number, rand: () => number) {
  if (energy < 0.002) return;
  const kick = 0.018 * energy;
  const slide = 0.0016 * energy;
  for (let i = 0; i < g.x.length; i++) {
    const [a, ax, ay] = field(mode, g.x[i], g.y[i]);
    const amp = Math.abs(a);
    let nx = g.x[i] + (rand() - 0.5) * kick * amp - slide * a * ax;
    let ny = g.y[i] + (rand() - 0.5) * kick * amp - slide * a * ay;
    if (nx < 0.004) nx = 0.004 + rand() * 0.004;
    if (nx > 0.996) nx = 0.996 - rand() * 0.004;
    if (ny < 0.004) ny = 0.004 + rand() * 0.004;
    if (ny > 0.996) ny = 0.996 - rand() * 0.004;
    g.x[i] = nx;
    g.y[i] = ny;
  }
}

/** 直接落在节线附近（减少动态效果时用，也用来给打开页面准备一个起点） */
export function settle(g: Grains, mode: Mode, rand: () => number) {
  for (let i = 0; i < g.x.length; i++) {
    for (let k = 0; k < 60; k++) {
      const x = rand();
      const y = rand();
      if (Math.abs(field(mode, x, y)[0]) < 0.06 + k * 0.004) {
        g.x[i] = x;
        g.y[i] = y;
        break;
      }
    }
  }
}

export function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

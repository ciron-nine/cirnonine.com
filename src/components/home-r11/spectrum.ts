/**
 * PROTOTYPE（首页第十一轮）：光谱型。这里只放物理：
 * - 一种颜色的色温：按它的冷暖（黄对蓝）投到黑体轨迹上
 * - 温度 → 哈佛光谱型 O B A F G K M 和次型 0–9（太阳是 G2）
 * - 温度 → 那个黑体本身的颜色（星画成这个颜色）
 * - 温度 → 一条光谱：普朗克曲线定亮度，再按光谱型刻上吸收线（巴尔末线、钙 H/K、钠 D、氧化钛分子带……）
 * 黑体的色度用 Kim 等人（2002）的三次近似；波长到颜色用 Bruton 的近似。
 */

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

/** 哈佛分类每一型的温度范围（K），热到冷 */
export const CLASSES: { cls: SpectralClass; hot: number; cool: number; note: string }[] = [
  { cls: 'O', hot: 50000, cool: 30000, note: '电离氦' },
  { cls: 'B', hot: 30000, cool: 10000, note: '中性氦' },
  { cls: 'A', hot: 10000, cool: 7500, note: '氢线最强' },
  { cls: 'F', hot: 7500, cool: 6000, note: '电离钙' },
  { cls: 'G', hot: 6000, cool: 5200, note: '太阳这一型' },
  { cls: 'K', hot: 5200, cool: 3700, note: '金属线' },
  { cls: 'M', hot: 3700, cool: 1667, note: '氧化钛' },
];

const T_MIN = 1667;
const T_MAX = 50000;

/** 黑体在 CIE 1931 xy 上的色度（Kim 等人的近似，超出 25000 K 外推） */
export function planckXY(T: number): [number, number] {
  const t = Math.min(Math.max(T, T_MIN), T_MAX);
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039;
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** sRGB → Oklab */
export function oklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** 黑体轨迹上每个温度的冷暖（Oklab 的 b：负是偏蓝，正是偏黄） */
let LOCUS_CACHE: { T: number; b: number }[] | undefined;
const locus = () => (LOCUS_CACHE ??= (() => {
  const pts: { T: number; b: number }[] = [];
  for (let m = 1e6 / T_MAX; m <= 1e6 / T_MIN; m += 0.5) {
    const T = 1e6 / m;
    pts.push({ T, b: oklab(blackbodyHex(T))[2] });
  }
  return pts;
})());
/** 封面颜色冷暖的常见范围（Oklab b）：再蓝不过约 −0.25，再黄不过约 +0.18 */
const COVER_BLUE = -0.25;
const COVER_YELLOW = 0.18;

/**
 * 一种颜色的色温（K）。真的星的颜色都落在黑体轨迹上，封面的颜色大多不在（紫的、绿的）。
 * 这里只取它的冷暖——Oklab 的 b 轴，黄对蓝——按比例投到黑体轨迹的冷暖上，找出冷暖一样的那个温度：
 * 中性的灰白落在 6500 K 左右（F 型），越蓝越热，越黄越红越冷。
 */
export function cct(hex: string): number {
  const pts = locus();
  const hot = Math.min(...pts.map((p) => p.b));
  const cool = Math.max(...pts.map((p) => p.b));
  const b = oklab(hex)[2];
  const target = b >= 0 ? (Math.min(b, COVER_YELLOW) / COVER_YELLOW) * cool : (Math.max(b, COVER_BLUE) / COVER_BLUE) * hot;
  let best = pts[0];
  for (const p of pts) if (Math.abs(p.b - target) < Math.abs(best.b - target)) best = p;
  return best.T;
}

/** 光谱型和次型：在一型的温度范围里按对数分十档，热的一头是 0 */
export function classify(T: number): { cls: SpectralClass; sub: number; label: string } {
  const c = CLASSES.find((k) => T >= k.cool) ?? CLASSES[CLASSES.length - 1];
  const t = Math.min(Math.max(T, c.cool), c.hot);
  const sub = Math.min(9, Math.floor((10 * Math.log(c.hot / t)) / Math.log(c.hot / c.cool)));
  return { cls: c.cls, sub, label: `${c.cls}${sub}` };
}

/** 黑体本身的颜色（sRGB，最亮的通道归一到 1） */
export function blackbodyHex(T: number): string {
  const [x, y] = planckXY(T);
  const X = x / y;
  const Z = (1 - x - y) / y;
  let r = 3.2406 * X - 1.5372 - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 + 1.057 * Z;
  const m = Math.max(r, g, b);
  [r, g, b] = [r, g, b].map((c) => Math.max(c / m, 0));
  return `#${[r, g, b].map((c) => Math.round(gam(c) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** 普朗克定律（只要相对值） */
const planck = (nm: number, T: number) => {
  const l = nm * 1e-9;
  return 1 / (l ** 5 * (Math.exp(0.014388 / (l * T)) - 1));
};

/** 波长 → 显示用的颜色（Bruton） */
function wavelengthRgb(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, (510 - nm) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, (645 - nm) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  // 两头人眼不敏感，暗下去
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [r * f, g * f, b * f];
}

/** 吸收线：波长（nm）、宽度（nm）、各型的深度 */
type Line = { nm: number; w: number; depth: Partial<Record<SpectralClass, number>>; name?: string };
const H = { O: 0.15, B: 0.45, A: 0.85, F: 0.55, G: 0.3, K: 0.15, M: 0.08 };
export const LINES: Line[] = [
  { nm: 656.3, w: 1.6, depth: H, name: 'Hα' },
  { nm: 486.1, w: 1.6, depth: H, name: 'Hβ' },
  { nm: 434.0, w: 1.6, depth: H, name: 'Hγ' },
  { nm: 410.2, w: 1.6, depth: H, name: 'Hδ' },
  { nm: 468.6, w: 1.2, depth: { O: 0.45 } },
  { nm: 541.1, w: 1.2, depth: { O: 0.3 } },
  { nm: 447.1, w: 1.2, depth: { O: 0.25, B: 0.45 } },
  { nm: 587.6, w: 1.2, depth: { O: 0.15, B: 0.35 } },
  { nm: 402.6, w: 1.2, depth: { B: 0.3 } },
  { nm: 393.4, w: 2.2, depth: { A: 0.3, F: 0.6, G: 0.85, K: 0.9, M: 0.7 }, name: 'K' },
  { nm: 396.8, w: 2.2, depth: { A: 0.25, F: 0.55, G: 0.8, K: 0.85, M: 0.65 }, name: 'H' },
  { nm: 430.8, w: 1.5, depth: { F: 0.2, G: 0.45, K: 0.5, M: 0.3 } },
  { nm: 438.4, w: 0.8, depth: { G: 0.2, K: 0.3 } },
  { nm: 517.3, w: 1.2, depth: { F: 0.15, G: 0.35, K: 0.5, M: 0.4 } },
  { nm: 527.0, w: 0.8, depth: { G: 0.2, K: 0.3 } },
  { nm: 589.3, w: 1.6, depth: { F: 0.1, G: 0.3, K: 0.55, M: 0.65 }, name: 'D' },
];
/** M 型的氧化钛分子带：带头陡，往红的一侧慢慢变浅 */
const TIO = [476.1, 495.4, 516.7, 544.8, 586.0, 615.9, 705.4];

export function absorption(nm: number, cls: SpectralClass): number {
  let keep = 1;
  for (const l of LINES) {
    const d = l.depth[cls];
    if (d) keep *= 1 - d * Math.exp(-(((nm - l.nm) / l.w) ** 2));
  }
  if (cls === 'M' || cls === 'K') {
    const k = cls === 'M' ? 0.6 : 0.15;
    for (const head of TIO) if (nm >= head && nm < head + 18) keep *= 1 - k * (1 - (nm - head) / 18);
  }
  return keep;
}

export const VISIBLE: [number, number] = [380, 720];

/** 一组星的光加在一起，混合后的色温：按倒数色温（mired）取平均，这是混合光源时的常用近似 */
export function mixedTemperature(Ts: number[]): number {
  if (!Ts.length) return 5772;
  return 1e6 / (Ts.reduce((sum, T) => sum + 1e6 / T, 0) / Ts.length);
}

/**
 * 在一块画布上画光谱。给一个温度，是那颗星的光谱；给一组温度，是它们一样亮、加在一起的光谱
 * （亮度相加，吸收线按各自在这个波长上的亮度加权）。
 */
export function drawSpectrum(canvas: HTMLCanvasElement, T: number | number[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const Ts = Array.isArray(T) ? T : [T];
  if (!Ts.length) return;
  const { width, height } = canvas;
  const [a, b] = VISIBLE;
  const peaks = Ts.map((t) => {
    let p = 0;
    for (let nm = a; nm <= b; nm += 2) p = Math.max(p, planck(nm, t));
    return p;
  });
  const classes = Ts.map((t) => classify(t).cls);
  const raw: number[] = [];
  for (let x = 0; x < width; x++) {
    const nm = a + ((b - a) * x) / (width - 1);
    let sum = 0;
    let absorbed = 0;
    Ts.forEach((t, i) => {
      const I = planck(nm, t) / peaks[i];
      sum += I;
      absorbed += I * absorption(nm, classes[i]);
    });
    raw.push(sum > 0 ? Math.pow(sum / Ts.length, 0.45) * (absorbed / sum) : 0);
  }
  const top = Math.max(...raw, 1e-6);
  const img = ctx.createImageData(width, height);
  for (let x = 0; x < width; x++) {
    const nm = a + ((b - a) * x) / (width - 1);
    const I = raw[x] / top;
    const [r, g, bl] = wavelengthRgb(nm);
    const px = [gam(lin(r) * I), gam(lin(g) * I), gam(lin(bl) * I)].map((c) => Math.round(c * 255));
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      img.data[i] = px[0];
      img.data[i + 1] = px[1];
      img.data[i + 2] = px[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

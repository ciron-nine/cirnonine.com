/**
 * PROTOTYPE（第四轮）：宇宙背景的布局和数学，浏览器里的 WebGL 和构建时的静态后备共用。
 *
 * 世界坐标（右手，y 向上，镜头一开始朝 -z 看）：
 * - 第一屏：整片星空，银河（BAND_NORMAL 定的大圆）斜穿画面
 * - 带环的气态巨行星在 PLANET：小册子翻开第一页（收录｜写在里面）时镜头停在它旁边
 * - 数据生成的螺旋星系在 GALAXY：翻到第二页（摘录｜最近完成）时落在它的一条旋臂上方
 * - 星云在 NEBULA，镜头从行星飞向星系时从里面穿过
 * 滚动进度 p：0 是小册子合着，1、2 是翻开第一页、第二页；镜头沿 CAMERA 的关键帧走。
 */

export type Vec3 = [number, number, number];

export const PLANET = { center: [-7, 1.5, -4] as Vec3, radius: 2.4, ringInner: 1.35, ringOuter: 2.35, tilt: 0.42 };
export const NEBULA = { center: [12, -3, -42] as Vec3, size: 13 };
export const GALAXY = { center: [-4, -14, -125] as Vec3, radius: 42, tilt: 1.05 };

/** 银河所在大圆的法向：第一屏的视线几乎落在这个大圆上，银河从右下斜到左上 */
export const BAND_NORMAL: Vec3 = normalizeV([0.6, 0.78, 0.02]);
/** 银河中心的方向（那里更亮、偏金色） */
export const BAND_CENTER: Vec3 = normalizeV([0.35, -0.29, -0.89]);

/** 镜头关键帧：位置和看向的点。p = 0..2 */
export const CAMERA: { pos: Vec3; target: Vec3 }[] = [
  // 星空：镜头微微仰起，银河斜穿画面；行星在左下角远远的，星系藏在下面
  { pos: [2, 6, 40], target: [-2, 10, -40] },
  // 行星：靠近到光环比屏幕还宽，行星在左下，从小册子左页下面露出来
  { pos: [-1, 3, 4], target: [-9.8, 1.5, -1.9] },
  // 星系：穿过星云以后，正对盘面、落在旋臂上方，核心偏到左上角
  { pos: [10, -2, -88], target: [10, -21, -121] },
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** 进度 p 处镜头的位置和看向的点（Catmull-Rom 曲线，经过每个关键帧） */
export function cameraAt(p: number): { pos: Vec3; target: Vec3 } {
  const n = CAMERA.length;
  const clamped = Math.min(Math.max(p, 0), n - 1);
  const i = Math.min(Math.floor(clamped), n - 2);
  const t = clamped - i;
  const k = (j: number) => CAMERA[Math.min(Math.max(j, 0), n - 1)];
  const lerp = (key: 'pos' | 'target') =>
    [0, 1, 2].map((c) => catmull(k(i - 1)[key][c], k(i)[key][c], k(i + 1)[key][c], k(i + 2)[key][c], t)) as Vec3;
  return { pos: lerp('pos'), target: lerp('target') };
}

/** 固定种子的伪随机 */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gaussian(rand: () => number) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

// ---------- 螺旋星系 ----------

/** 对数螺线 r = A·e^(Bθ)；四条旋臂各差 90°，一个类别一条 */
const ARM_A = 0.06;
const ARM_B = 0.36;
export const ARMS = 4;

/**
 * 星系里的粒子，在星系自己的平面坐标里：x、z 是盘面，y 是厚度。
 * 返回 [x, y, z, 亮度, 半径]：亮度 0..1，半径用来在着色器里算较差自转。
 * records 是每条记录的 { arm, along, mag }：arm 是类别那条旋臂，along 0..1 是沿旋臂的位置，mag 是亮度。
 */
export function galaxyParticles(
  count: number,
  records: { arm: number; along: number; mag: number }[],
  seed = 7,
): Float32Array {
  const rand = seeded(seed);
  const out = new Float32Array((count + records.length) * 5);
  const put = (i: number, x: number, y: number, z: number, b: number) => {
    out.set([x, y, z, b, Math.hypot(x, z)], i * 5);
  };
  const thetaMax = Math.log(1 / ARM_A) / ARM_B; // r = 1 时的角度
  for (let i = 0; i < count; i++) {
    const kind = rand();
    if (kind < 0.18) {
      // 核球：三维高斯
      const r = Math.abs(gaussian(rand)) * 0.12;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      put(i, r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th), 0.5 + rand() * 0.5);
    } else if (kind < 0.85) {
      // 旋臂：沿对数螺线，越往外越散
      const arm = Math.floor(rand() * ARMS);
      const t = Math.pow(rand(), 0.7);
      const th = t * thetaMax;
      const r = ARM_A * Math.exp(ARM_B * th);
      const spread = 0.012 + r * 0.045;
      const a = th + (arm * Math.PI * 2) / ARMS;
      put(
        i,
        r * Math.cos(a) + gaussian(rand) * spread,
        gaussian(rand) * 0.012 * (1 + r),
        r * Math.sin(a) + gaussian(rand) * spread,
        0.15 + rand() * 0.45,
      );
    } else {
      // 盘面上的散星
      const r = Math.sqrt(rand()) * 1.05;
      const a = rand() * Math.PI * 2;
      put(i, r * Math.cos(a), gaussian(rand) * 0.02, r * Math.sin(a), 0.05 + rand() * 0.2);
    }
  }
  records.forEach(({ arm, along, mag }, j) => {
    const th = (0.25 + along * 0.7) * thetaMax;
    const r = ARM_A * Math.exp(ARM_B * th);
    const a = th + (arm * Math.PI * 2) / ARMS + (rand() - 0.5) * 0.08;
    // 亮度 > 1 标记成记录星，着色器里画得更大
    put(count + j, r * Math.cos(a), (rand() - 0.5) * 0.02, r * Math.sin(a), 1 + mag);
  });
  return out;
}


// ---------- 背景星空 ----------

/** 恒星按光谱型（温度）的颜色，近似黑体：红矮星最多、最暗，蓝白的少而亮 */
const SPECTRAL: { share: number; color: Vec3 }[] = [
  { share: 0.32, color: [1.0, 0.69, 0.48] }, // M
  { share: 0.22, color: [1.0, 0.82, 0.63] }, // K
  { share: 0.2, color: [1.0, 0.95, 0.87] }, // G
  { share: 0.14, color: [0.97, 0.97, 1.0] }, // F
  { share: 0.08, color: [0.79, 0.85, 1.0] }, // A
  { share: 0.04, color: [0.66, 0.76, 1.0] }, // B
];

/** 一颗星的颜色：越亮越可能是热的（蓝白），越暗越可能是红的 */
export function starColor(mag: number, rand: () => number): Vec3 {
  // 亮度把抽样往热的一端推
  let x = Math.min(0.999, rand() * (1 - mag * 0.55) + mag * 0.55);
  for (const { share, color } of SPECTRAL) {
    if (x < share) return color;
    x -= share;
  }
  return SPECTRAL[SPECTRAL.length - 1].color;
}

/**
 * 背景星：[x, y, z, 亮度, r, g, b]。
 * 大部分在远处的球壳上（几乎不动），其中四成挤在银河的大圆附近；一部分散在镜头会经过的空间里（有视差）。
 */
export const STAR_STRIDE = 7;
export function starfield(count: number, seed = 3): Float32Array {
  const rand = seeded(seed);
  const out = new Float32Array(count * STAR_STRIDE);
  const [e1, e2] = basis(BAND_NORMAL);
  for (let i = 0; i < count; i++) {
    const kind = rand();
    let x: number;
    let y: number;
    let z: number;
    if (kind < 0.3) {
      x = (rand() - 0.5) * 120;
      y = (rand() - 0.5) * 60 - 4;
      z = 40 - rand() * 200;
    } else {
      let dir: Vec3;
      if (kind < 0.72) {
        // 银河：沿大圆均匀，离大圆的角度是很窄的高斯
        const th = rand() * Math.PI * 2;
        const lat = gaussian(rand) * 0.1;
        const c = Math.cos(lat);
        dir = normalizeV([
          (e1[0] * Math.cos(th) + e2[0] * Math.sin(th)) * c + BAND_NORMAL[0] * Math.sin(lat),
          (e1[1] * Math.cos(th) + e2[1] * Math.sin(th)) * c + BAND_NORMAL[1] * Math.sin(lat),
          (e1[2] * Math.cos(th) + e2[2] * Math.sin(th)) * c + BAND_NORMAL[2] * Math.sin(lat),
        ]);
      } else {
        const th = rand() * Math.PI * 2;
        const ph = Math.acos(2 * rand() - 1);
        dir = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      }
      const r = 400 + rand() * 200;
      x = dir[0] * r;
      y = dir[1] * r;
      z = dir[2] * r;
    }
    const mag = Math.pow(rand(), kind < 0.72 && kind >= 0.3 ? 4 : 3);
    out.set([x, y, z, mag, ...starColor(mag, rand)], i * STAR_STRIDE);
  }
  return out;
}

/** 和 n 垂直的两个单位向量 */
export function basis(n: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = normalizeV(cross(a, n));
  return [e1, cross(n, e1)];
}

// ---------- 透视投影（静态后备用） ----------

export function project(p: Vec3, cam: { pos: Vec3; target: Vec3 }, fovY: number, aspect: number): [number, number, number] | null {
  const f = normalize(sub(cam.target, cam.pos));
  const r = normalize(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, cam.pos);
  const z = dot(d, f);
  if (z < 0.1) return null;
  const k = 1 / Math.tan(fovY / 2);
  return [(dot(d, r) * k) / (z * aspect), (dot(d, u) * k) / z, z];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normalizeV(a: Vec3): Vec3 {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 星系平面坐标到世界坐标：先绕 x 轴倾斜，再缩放平移到 GALAXY */
export function galaxyToWorld(x: number, y: number, z: number): Vec3 {
  const c = Math.cos(GALAXY.tilt);
  const s = Math.sin(GALAXY.tilt);
  const yy = y * c - z * s;
  const zz = y * s + z * c;
  return [GALAXY.center[0] + x * GALAXY.radius, GALAXY.center[1] + yy * GALAXY.radius, GALAXY.center[2] + zz * GALAXY.radius];
}

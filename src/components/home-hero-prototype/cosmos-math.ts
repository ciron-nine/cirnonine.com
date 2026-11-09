/**
 * PROTOTYPE（第三轮）：宇宙背景的布局和数学，浏览器里的 WebGL 和构建时的静态后备共用。
 *
 * 世界坐标（右手，y 向上，镜头一开始朝 -z 看）：
 * - 带环的气态巨行星在 PLANET，第一摊（封面｜收录）停在它旁边
 * - 星云在 NEBULA，里面是三体问题的 8 字形轨道，第二摊（写在里面｜摘录）停在这里
 * - 数据生成的螺旋星系在 GALAXY，第三摊（最近完成｜版权页）停在它的一条旋臂上
 * 滚动进度 p：0 是第一屏的远景，1、2、3 是三摊各自居中的时候；镜头沿 CAMERA 的关键帧走。
 */

export type Vec3 = [number, number, number];

export const PLANET = { center: [-7, 1.5, -4] as Vec3, radius: 2.4, ringInner: 1.35, ringOuter: 2.35, tilt: 0.42 };
export const NEBULA = { center: [12, -3, -42] as Vec3, size: 13 };
/** 8 字形轨道在星云里的位置和大小 */
export const THREE_BODY = { center: [11, -2.5, -40] as Vec3, scale: 2.4 };
export const GALAXY = { center: [-4, -14, -125] as Vec3, radius: 42, tilt: 1.05 };

/** 镜头关键帧：位置和看向的点。p = 0..3 */
export const CAMERA: { pos: Vec3; target: Vec3 }[] = [
  // 远景：三样都在画面里，行星在左前方，星云在右边，星系在远处
  { pos: [0, 9, 34], target: [0, -3, -40] },
  // 行星：靠近到光环比屏幕还高，行星偏到右边，隔着「收录」那一页透出来，光环从纸的上下边伸出去
  { pos: [-1, 3, 4], target: [-9.8, 1.5, -1.9] },
  // 星云：钻进星云，三颗星偏右，在「摘录」那一页后面追逐
  { pos: [7.5, -1, -28], target: [8.9, -2.5, -40.6] },
  // 星系：正对盘面、落在旋臂上方，核心偏到左上角，一条旋臂斜穿过画面
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

// ---------- 三体问题的 8 字形周期解（Chenciner–Montgomery 2000） ----------

/** 周期（G = m = 1） */
export const FIGURE8_PERIOD = 6.32591398;

/** 沿一个周期积分出第一颗星的轨迹（另外两颗是同一条曲线，相位各差三分之一周期） */
export function figureEight(samples: number): [number, number][] {
  const pos = [
    [0.97000436, -0.24308753],
    [-0.97000436, 0.24308753],
    [0, 0],
  ];
  const v3 = [-0.93240737, -0.86473146];
  const vel = [
    [-v3[0] / 2, -v3[1] / 2],
    [-v3[0] / 2, -v3[1] / 2],
    [v3[0], v3[1]],
  ];
  const acc = (p: number[][]) =>
    p.map((pi, i) => {
      let ax = 0;
      let ay = 0;
      p.forEach((pj, j) => {
        if (i === j) return;
        const dx = pj[0] - pi[0];
        const dy = pj[1] - pi[1];
        const r3 = Math.pow(dx * dx + dy * dy, 1.5);
        ax += dx / r3;
        ay += dy / r3;
      });
      return [ax, ay];
    });
  const out: [number, number][] = [];
  const sub = 20;
  const dt = FIGURE8_PERIOD / samples / sub;
  for (let s = 0; s < samples; s++) {
    out.push([pos[0][0], pos[0][1]]);
    for (let k = 0; k < sub; k++) {
      // 蛙跳法：长时间积分也守恒，曲线首尾接得上
      let a = acc(pos);
      for (let i = 0; i < 3; i++) {
        vel[i][0] += (a[i][0] * dt) / 2;
        vel[i][1] += (a[i][1] * dt) / 2;
        pos[i][0] += vel[i][0] * dt;
        pos[i][1] += vel[i][1] * dt;
      }
      a = acc(pos);
      for (let i = 0; i < 3; i++) {
        vel[i][0] += (a[i][0] * dt) / 2;
        vel[i][1] += (a[i][1] * dt) / 2;
      }
    }
  }
  return out;
}

// ---------- 背景星空 ----------

/** 背景星：大部分在远处的球壳上（几乎不动），一部分散在镜头会经过的空间里（有视差） */
export function starfield(count: number, seed = 3): Float32Array {
  const rand = seeded(seed);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const near = rand() < 0.35;
    let x: number;
    let y: number;
    let z: number;
    if (near) {
      x = (rand() - 0.5) * 120;
      y = (rand() - 0.5) * 60 - 4;
      z = 40 - rand() * 200;
    } else {
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      const r = 400 + rand() * 200;
      x = r * Math.sin(ph) * Math.cos(th);
      y = r * Math.cos(ph);
      z = r * Math.sin(ph) * Math.sin(th) - 60;
    }
    out.set([x, y, z, Math.pow(rand(), 3)], i * 4);
  }
  return out;
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

/** 8 字形轨道平面坐标到世界坐标：轨道平面朝镜头斜一点 */
export function threeBodyToWorld(x: number, y: number): Vec3 {
  const s = THREE_BODY.scale;
  return [THREE_BODY.center[0] + x * s, THREE_BODY.center[1] + y * s * 0.8, THREE_BODY.center[2] + y * s * 0.6];
}

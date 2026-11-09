/**
 * PROTOTYPE：三个背景变体的数学，CPU 版。构建时用它画静态后备（webp），浏览器里的 WebGL 着色器写的是同一套公式。
 * 改了这里的公式或常数，要同步改 gl-*.ts 里对应的 GLSL。
 *
 * 坐标约定：图形坐标 1 对应 --unit 的一半（--unit 见 HomeBackdrop.astro：短边的 0.65 加长边的 0.35），
 * 所以桌面上图形铺开一个屏幕高度多一点，手机竖屏上会溢出屏幕两侧，像背景而不是一个摆在中间的物件。
 */

export type Vec3 = [number, number, number];

/** 视角：绕竖轴转 yaw，再往下俯 tilt，透视距离 dist。返回屏幕 x、y（y 向上）和深度（越大越近，约 -1..1） */
export function view(p: Vec3, yaw: number, tilt: number, dist: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y = p[1] * ct - z1 * st;
  const z = p[1] * st + z1 * ct;
  const k = dist / (dist - z);
  return [x * k, y * k, z];
}

// ---------- A：Hopf 纤维化 ----------

export const HOPF = { rings: 6, fibers: 48, segments: 120, fit: 0.46, dist: 6 };

/** S² 上纬度 eta、经度 phi 的点，它的纤维（S³ 里的大圆）在参数 t 处的点 */
function fiber(eta: number, phi: number, t: number): [number, number, number, number] {
  const a = Math.sin(eta) * Math.cos(phi);
  const b = Math.sin(eta) * Math.sin(phi);
  const c = Math.cos(eta);
  const k = 1 / Math.sqrt(2 * (1 + c));
  return [k * (1 + c) * Math.cos(t), k * (a * Math.sin(t) - b * Math.cos(t)), k * (a * Math.cos(t) + b * Math.sin(t)), k * (1 + c) * Math.sin(t)];
}

/** 第 ring 圈（0..1）上经度 phi 的那根纤维，在动画时间 time 时 t 处的三维点和透明度 */
export function hopfPoint(ring: number, phi: number, t: number, time: number, pulse = 0): { p: Vec3; alpha: number } {
  const eta = Math.PI * (0.2 + 0.6 * ring) + 0.15 * (1 + pulse * 0.6) * Math.sin(time * 0.13 + ring * 5);
  const q = fiber(eta, phi + time * 0.05 * (ring - 0.5), t);
  // 四维里转：x–w 平面来回摆（转满一圈的话圆环会频繁穿过投影点、飞到无穷远，满屏乱线），
  // y–z 平面一直转；圆环就会翻卷、互相穿过
  const a = 0.5 + 0.85 * Math.sin(time * 0.07);
  const b = time * 0.05;
  const x = q[0] * Math.cos(a) - q[3] * Math.sin(a);
  const w = q[0] * Math.sin(a) + q[3] * Math.cos(a);
  const y = q[1] * Math.cos(b) - q[2] * Math.sin(b);
  const z = q[1] * Math.sin(b) + q[2] * Math.cos(b);
  // 球极投影到三维；靠近投影点的纤维会飞到很远，淡掉
  const d = Math.max(1 - w, 1e-3);
  const p: Vec3 = [x / d, y / d, z / d];
  const r = Math.hypot(...p);
  const alpha = 1 - smoothstep(1.8, 4.2, r);
  return { p: [p[0] * HOPF.fit, p[1] * HOPF.fit, p[2] * HOPF.fit], alpha };
}

export function hopfView(time: number): { yaw: number; tilt: number } {
  return { yaw: time * 0.04 + 0.3, tilt: 0.35 + 0.1 * Math.sin(time * 0.05) };
}

// ---------- B：Thomas 吸引子 ----------

/** Thomas 吸引子的参数 b：在 0.18 附近慢慢漂移，形状跟着变（b 越小越乱） */
export function thomasB(time: number): number {
  return 0.19 + 0.022 * Math.sin(time * 0.045);
}

export const THOMAS = { fit: 0.21, dist: 9 };

export function thomasTrajectory(n: number, b: number, dt = 0.04, start: Vec3 = [0.1, 0, -0.2]): Vec3[] {
  let [x, y, z] = start;
  const out: Vec3[] = [];
  const f = (x: number, y: number, z: number): Vec3 => [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z];
  for (let i = 0; i < n + 500; i++) {
    const k1 = f(x, y, z);
    const k2 = f(x + (k1[0] * dt) / 2, y + (k1[1] * dt) / 2, z + (k1[2] * dt) / 2);
    x += k2[0] * dt;
    y += k2[1] * dt;
    z += k2[2] * dt;
    if (i >= 500) out.push([x * THOMAS.fit, y * THOMAS.fit, z * THOMAS.fit]);
  }
  return out;
}

export function thomasView(time: number): { yaw: number; tilt: number } {
  return { yaw: time * 0.03 + 0.7, tilt: 0.55 };
}

// ---------- C：变形的参数曲面（Klein 瓶 → Boy 曲面 → Enneper 曲面 → …） ----------

export const SURFACE = { lines: 56, segments: 160, fit: 0.9, dist: 6, period: 24 };

const TAU = Math.PI * 2;

/** Klein 瓶的「8 字」浸入 */
export function klein(u: number, v: number): Vec3 {
  const U = u * TAU;
  const V = v * TAU;
  const c = Math.cos(U / 2);
  const s = Math.sin(U / 2);
  const w = 2 + c * Math.sin(V) - s * Math.sin(2 * V);
  return [(w * Math.cos(U)) / 3, (s * Math.sin(V) + c * Math.sin(2 * V)) / 3, (w * Math.sin(U)) / 3];
}

/** Boy 曲面（Apéry 参数化） */
export function boy(u: number, v: number): Vec3 {
  const U = u * Math.PI;
  const V = v * Math.PI;
  const cv = Math.cos(V);
  const d = 2 - Math.SQRT2 * Math.sin(3 * U) * Math.sin(2 * V);
  const x = (Math.SQRT2 * cv * cv * Math.cos(2 * U) + Math.cos(U) * Math.sin(2 * V)) / d;
  const y = (Math.SQRT2 * cv * cv * Math.sin(2 * U) - Math.sin(U) * Math.sin(2 * V)) / d;
  const z = (3 * cv * cv) / d;
  return [x / 1.4, (z - 1.1) / 1.4, y / 1.4];
}

/** Enneper 极小曲面 */
export function enneper(u: number, v: number): Vec3 {
  const r = v * 1.5;
  const th = u * TAU;
  const x = r * Math.cos(th) - (r ** 3 * Math.cos(3 * th)) / 3;
  const y = -r * Math.sin(th) - (r ** 3 * Math.sin(3 * th)) / 3;
  const z = r * r * Math.cos(2 * th);
  return [x / 2.4, z / 2.4, y / 2.4];
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** 三个曲面的权重：每个停留一阵，再慢慢变成下一个 */
export function surfaceWeights(time: number): Vec3 {
  const phase = (time / SURFACE.period) % 3;
  const w: Vec3 = [0, 0, 0];
  const i = Math.floor(phase);
  const f = smoothstep(0.55, 1, phase - i);
  w[i] = 1 - f;
  w[(i + 1) % 3] = f;
  return w;
}

export function surfacePoint(u: number, v: number, time: number, pulse = 0): Vec3 {
  const [a, b, c] = surfaceWeights(time);
  const k = klein(u, v);
  const y = boy(u, v);
  const e = enneper(u, v);
  const ripple = 1 + 0.05 * (1 + pulse * 1.5) * Math.sin(u * TAU * 4 + time * 1.1) * Math.sin(v * TAU * 3 - time * 0.8);
  return [0, 1, 2].map((i) => (a * k[i] + b * y[i] + c * e[i]) * ripple * SURFACE.fit) as Vec3;
}

export function surfaceView(time: number): { yaw: number; tilt: number } {
  return { yaw: time * 0.06 + 0.4, tilt: 0.45 + 0.15 * Math.sin(time * 0.07) };
}

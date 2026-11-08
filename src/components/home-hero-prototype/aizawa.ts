/**
 * PROTOTYPE 变体 A：Aizawa 吸引子。浏览器里的 WebGL 层和构建时生成的静态图共用这份数值。
 *
 * 选 Aizawa 而不是 Lorenz / Thomas：Lorenz 的蝴蝶太常见，Thomas 是三向对称的一团，
 * Aizawa 是一个球壳加一根贯穿的管，线在壳上一圈圈缠绕，转起来像一卷线团，最适合铅笔线的密度变化。
 */

const A = 0.95;
const B = 0.7;
const C = 0.6;
const D = 3.5;
const E = 0.25;
const F = 0.1;

function deriv(x: number, y: number, z: number, out: number[]) {
  out[0] = (z - B) * x - D * y;
  out[1] = D * x + (z - B) * y;
  out[2] = C + A * z - (z * z * z) / 3 - (x * x + y * y) * (1 + E * z) + F * z * x * x * x;
}

/**
 * 沿一条轨迹积分 n 个点（RK4），返回 [x, y, z, ...]，已经平移到中心、缩放到最大半径为 1。
 * 坐标约定：z 是吸引子自己的轴，画的时候竖着放。
 */
export function aizawaPoints(n: number, dt = 0.01): Float32Array {
  const out = new Float32Array(n * 3);
  let x = 0.1;
  let y = 0;
  let z = 0;
  const k1 = [0, 0, 0];
  const k2 = [0, 0, 0];
  const k3 = [0, 0, 0];
  const k4 = [0, 0, 0];
  const step = () => {
    deriv(x, y, z, k1);
    deriv(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2], k2);
    deriv(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2], k3);
    deriv(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2], k4);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  };
  // 先走一段，落到吸引子上
  for (let i = 0; i < 2000; i++) step();
  for (let i = 0; i < n; i++) {
    step();
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  // z 大约在 [-0.5, 1.9]，x/y 在 [-1.5, 1.5]：以包围盒中心为原点，按最大半径缩放
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minZ = Math.min(minZ, out[i * 3 + 2]);
    maxZ = Math.max(maxZ, out[i * 3 + 2]);
  }
  const cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let i = 0; i < n; i++) {
    out[i * 3 + 2] -= cz;
    r = Math.max(r, Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]));
  }
  for (let i = 0; i < out.length; i++) out[i] /= r;
  return out;
}

/** 视角：绕竖轴的初始角和往下看的俯角。静态图用 angle = START_ANGLE，和 WebGL 第一帧一致 */
export const START_ANGLE = 0.6;
export const TILT = 0.38;
/** 吸引子在主视觉里占短边的比例 */
export const FIT = 0.86;

/** 正交投影到 [-1, 1] 平面（y 向上），返回屏幕 x、y 和深度（越大越近） */
export function project(x: number, y: number, z: number, angle: number): [number, number, number] {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = x * ca - y * sa;
  const ry = x * sa + y * ca;
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  // z 竖着放，ry 是朝向观众的方向，再整体往下俯一点
  const sy = z * ct - ry * st;
  const depth = z * st + ry * ct;
  return [rx, sy, depth];
}

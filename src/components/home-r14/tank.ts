/**
 * PROTOTYPE（首页第十四轮）：神冈的水池。只放几何和物理，不碰 three.js。
 *
 * 超级神冈：岐阜县神冈矿山地下 1,000 米，一个不锈钢圆柱水罐（内探测器直径 33.8 m、高 36.2 m），
 * 装着 50,220 吨超纯水，内壁贴满 11,146 颗直径 50 cm 的光电倍增管，间距约 0.7 m。
 * 带电粒子在水里跑得比水里的光还快时，会沿着前进方向发出一圈锥形的蓝光——切伦科夫辐射，光的「音爆」。
 * 锥角 θ 满足 cos θ = 1 / (nβ)；水的折射率 n = 1.33，接近光速的粒子 β ≈ 1，所以 θ ≈ 41°。
 * 这圈光打在罐壁上就是一个环，环上的倍增管亮起来。物理学家靠环的样子认粒子：
 *   μ 子：环的外缘锐利，里面也落着光（它走得直，一路都在发光）
 *   电子：会打出一阵簇射，环是毛的、发散的
 *   π⁰：衰变成两个光子，各打出一个毛环，所以是两个环
 *   太阳中微子撞出的低能电子：只有零零星星几十颗管子亮
 * 每条记录是一次事件：类别决定环的种类，顶点、方向由原名推出来——不看年代，不分高低。
 */

export const R = 16.9;
export const HALF_H = 18.1;
export const N_WATER = 1.33;
export const CHERENKOV = Math.acos(1 / N_WATER); // ≈ 41.2°

export type Ring = 'mu' | 'e' | 'pi0' | 'low';
export const RING_OF: Record<string, Ring> = { games: 'mu', 'visual-novels': 'e', anime: 'pi0', songs: 'low' };
export const RING_NAME: Record<Ring, string> = {
  mu: '锐利的环（μ 子）',
  e: '发散的环（电子）',
  pi0: '一对环（π⁰）',
  low: '零星的光（低能电子）',
};

export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h / 4294967296;
}

export interface Tank {
  /** 每颗管子的位置和朝内的法线，各 3 个数一组 */
  pos: Float32Array;
  normal: Float32Array;
  count: number;
}

/** 罐壁一圈圈、上下两个盖子按正方形排；spacing 越大管子越少（手机上用大一点） */
export function buildTank(spacing: number): Tank {
  const pos: number[] = [];
  const normal: number[] = [];
  const cols = Math.round((2 * Math.PI * R) / spacing);
  const rows = Math.floor((2 * HALF_H) / spacing);
  for (let j = 0; j < rows; j++) {
    const y = -HALF_H + spacing * (j + 0.5);
    for (let i = 0; i < cols; i++) {
      const a = ((i + (j % 2) * 0.5) / cols) * Math.PI * 2;
      pos.push(Math.sin(a) * R, y, Math.cos(a) * R);
      normal.push(-Math.sin(a), 0, -Math.cos(a));
    }
  }
  for (const side of [-1, 1]) {
    for (let x = -R; x <= R; x += spacing)
      for (let z = -R; z <= R; z += spacing) {
        if (Math.hypot(x, z) > R - spacing * 0.6) continue;
        pos.push(x, side * HALF_H, z);
        normal.push(0, -side, 0);
      }
  }
  return { pos: new Float32Array(pos), normal: new Float32Array(normal), count: pos.length / 3 };
}

type V = [number, number, number];
const norm = (v: V): V => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** 绕单位轴 k 转 θ（罗德里格斯公式） */
function rotate(v: V, k: V, t: number): V {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kv = cross(k, v);
  const kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}

/** 从 v 出发沿 d 的射线打到罐壁的哪一点 */
export function hitWall(v: V, d: V): V {
  const a = d[0] ** 2 + d[2] ** 2;
  let t = Infinity;
  if (a > 1e-6) {
    const b = 2 * (v[0] * d[0] + v[2] * d[2]);
    const c = v[0] ** 2 + v[2] ** 2 - R * R;
    t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }
  const y = v[1] + d[1] * t;
  if (!Number.isFinite(t) || Math.abs(y) > HALF_H) t = ((Math.sign(d[1]) || 1) * HALF_H - v[1]) / d[1];
  return [v[0] + d[0] * t, v[1] + d[1] * t, v[2] + d[2] * t];
}

export interface Event {
  ring: Ring;
  /** 环的中心落在罐壁上的那一点（标名字、转镜头用） */
  center: V;
  /** 这一次的「指纹」：每条记录各不相同 */
  sig: { angle: number; sharp: number; fill: number; second?: number; echo: boolean };
  /**
   * 亮起来的管子：编号、亮度、晚多少秒亮、颜色（0 = 最早到的光，深蓝；1 = 最晚到的，冰白）。
   * 时间都放慢了很多倍：真的事件只有几十纳秒。
   */
  hits: { i: number; w: number; delay: number; tint: number }[];
}

/**
 * 一条记录的事件。全由原名（键）推出来，不看年代，也不分高低：
 * - 顶点和方向：粒子从罐子里哪里出发、朝哪里飞
 * - 锥角：粒子越接近光速，环张得越开。cos θ = 1/(nβ)，β 取 0.80–1.00，θ 在 20°–41° 之间
 * - 径迹长短（只有 μ 子）：飞得越远，环里面落的光越满
 * - 锐利程度：同一种粒子里也有的清、有的毛
 * - π⁰ 的两个光子分开多大的角
 * - μ 子停下来以后会衰变出一个电子，一两微秒后再亮起一个暗暗的毛环——有一半的 μ 子事件有这一声「回响」
 */
export function eventFor(key: string, category: string, tank: Tank): Event {
  const ring = RING_OF[category] ?? 'mu';
  const h = (s: string) => hash(key + s);
  const rr = Math.sqrt(h('r')) * R * 0.55;
  const ra = h('a') * Math.PI * 2;
  const v: V = [Math.sin(ra) * rr, (h('y') - 0.5) * HALF_H * 1.1, Math.cos(ra) * rr];
  const az = h('d') * Math.PI * 2;
  const el = (h('e') - 0.5) * 0.7;
  const d1 = norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
  const beta = ring === 'low' ? 0.97 + h('b') * 0.03 : 0.8 + h('b') * 0.2;
  const angle = Math.acos(Math.min(1, 1 / (N_WATER * beta)));
  const sharp = ring === 'mu' ? 0.012 + h('s') * 0.014 : ring === 'e' ? 0.055 + h('s') * 0.05 : ring === 'pi0' ? 0.04 + h('s') * 0.04 : 0.05;
  const fill = ring === 'mu' ? 0.15 + h('f') * 0.85 : 0;
  const dirs: { d: V; angle: number; sigma: number; delay: number; weight: number }[] = [{ d: d1, angle, sigma: sharp, delay: 0, weight: 1 }];
  let second: number | undefined;
  if (ring === 'pi0') {
    second = 0.45 + h('o') * 0.5;
    const perp = norm(cross(d1, [0, 1, 0]));
    const d2 = norm(rotate(d1, rotate(perp, d1, h('p') * Math.PI * 2), second));
    dirs.push({ d: d2, angle: Math.acos(1 / (N_WATER * (0.95 + h('b2') * 0.05))), sigma: sharp * 1.1, delay: 0.05, weight: 0.85 });
  }
  const echo = ring === 'mu' && h('echo') < 0.5;
  if (echo) {
    // 衰变电子：方向随机，毛、暗、晚
    const ea = h('ea') * Math.PI * 2;
    const ee = (h('ee') - 0.5) * 1.2;
    dirs.push({ d: norm([Math.sin(ea) * Math.cos(ee), Math.sin(ee), Math.cos(ea) * Math.cos(ee)]), angle: CHERENKOV, sigma: 0.09, delay: 1.1, weight: 0.38 });
  }
  const raw: { i: number; w: number; dist: number; open: number; extra: number }[] = [];
  let dmin = Infinity;
  let dmax = 0;
  for (let i = 0; i < tank.count; i++) {
    const p: V = [tank.pos[i * 3], tank.pos[i * 3 + 1], tank.pos[i * 3 + 2]];
    const n: V = [tank.normal[i * 3], tank.normal[i * 3 + 1], tank.normal[i * 3 + 2]];
    const toP: V = [p[0] - v[0], p[1] - v[1], p[2] - v[2]];
    const dist = Math.hypot(...toP);
    const u = norm(toP);
    if (dot(u, n) > -0.05) continue; // 光要迎面打到管子上
    let best = 0;
    let open = 1;
    let extra = 0;
    for (const r of dirs) {
      const ang = Math.acos(Math.min(1, Math.max(-1, dot(u, r.d))));
      const dev = ang - r.angle;
      let w = Math.exp(-(dev * dev) / (2 * r.sigma * r.sigma)) * r.weight;
      // μ 子一路都在发光：环里面也落着光，径迹越长越满
      if (ring === 'mu' && r.delay === 0 && ang < r.angle) w = Math.max(w, fill * 0.32 * (ang / r.angle) ** 1.5);
      if (r.delay > 0.5 && hash(`${key}${i}x`) < 0.45) w *= 0.25;
      if (w > best) {
        best = w;
        open = Math.min(ang / r.angle, 1);
        extra = r.delay;
      }
    }
    if (ring === 'e' && hash(`${key}${i}e`) < 0.35) best *= 0.3;
    if (ring === 'low') best = hash(`${key}${i}l`) < 0.16 ? best * (0.5 + hash(`${key}${i}m`) * 0.5) : 0;
    if (best < 0.1) continue;
    raw.push({ i, w: best, dist, open, extra });
    dmin = Math.min(dmin, dist);
    dmax = Math.max(dmax, dist);
  }
  // 锥从中间张开：越靠环心的越早亮，环边最后到；再加上光在水里走的先后
  const hits = raw.map((r) => {
    const tof = dmax > dmin ? (r.dist - dmin) / (dmax - dmin) : 0;
    return { i: r.i, w: r.w, delay: r.extra + r.open * 0.45 + tof * 0.15, tint: Math.min(1, r.open * 0.7 + tof * 0.3) };
  });
  return { ring, center: hitWall(v, d1), sig: { angle: (angle * 180) / Math.PI, sharp, fill, second, echo }, hits };
}

/** 事件图（展开的罐壁 + 上下两个盖子，超级神冈的事件显示就是这样画的）上的坐标：0..1 */
export function displayXY(tank: Tank, i: number): [number, number, 'wall' | 'top' | 'bottom'] {
  const x = tank.pos[i * 3];
  const y = tank.pos[i * 3 + 1];
  const z = tank.pos[i * 3 + 2];
  if (Math.abs(Math.abs(y) - HALF_H) < 1e-3 && Math.hypot(x, z) < R - 0.1) return [x / R, z / R, y > 0 ? 'top' : 'bottom'];
  return [(Math.atan2(x, z) + Math.PI) / (Math.PI * 2), (HALF_H - y) / (2 * HALF_H), 'wall'];
}

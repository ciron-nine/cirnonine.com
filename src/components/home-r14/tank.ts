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
  /** 亮起来的管子：编号、亮度、比事件开始晚多少秒 */
  hits: { i: number; w: number; delay: number }[];
}

/** 一条记录的事件：顶点和方向由原名定，环的种类由类别定 */
export function eventFor(key: string, category: string, tank: Tank): Event {
  const ring = RING_OF[category] ?? 'mu';
  const h = (s: string) => hash(key + s);
  // 顶点在罐子里面（离壁远一点），方向大致朝外、偏一点上下
  const rr = Math.sqrt(h('r')) * R * 0.55;
  const ra = h('a') * Math.PI * 2;
  const v: V = [Math.sin(ra) * rr, (h('y') - 0.5) * HALF_H * 1.1, Math.cos(ra) * rr];
  const az = h('d') * Math.PI * 2;
  const el = (h('e') - 0.5) * 0.7;
  const d1 = norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
  const dirs: V[] = [d1];
  if (ring === 'pi0') {
    const perp = norm(cross(d1, [0, 1, 0]));
    dirs.push(norm(rotate(d1, rotate(perp, d1, h('p') * Math.PI * 2), 0.6 + h('o') * 0.25)));
  }
  const sigma = ring === 'mu' ? 0.018 : ring === 'e' ? 0.075 : ring === 'pi0' ? 0.06 : 0.05;
  const hits: Event['hits'] = [];
  let dmin = Infinity;
  let dmax = 0;
  const raw: { i: number; w: number; dist: number }[] = [];
  for (let i = 0; i < tank.count; i++) {
    const p: V = [tank.pos[i * 3], tank.pos[i * 3 + 1], tank.pos[i * 3 + 2]];
    const n: V = [tank.normal[i * 3], tank.normal[i * 3 + 1], tank.normal[i * 3 + 2]];
    const toP: V = [p[0] - v[0], p[1] - v[1], p[2] - v[2]];
    const dist = Math.hypot(...toP);
    const u = norm(toP);
    if (dot(u, n) > -0.05) continue; // 光要迎面打到管子上
    let w = 0;
    for (const d of dirs) {
      const ang = Math.acos(Math.min(1, Math.max(-1, dot(u, d))));
      const dev = ang - CHERENKOV;
      w = Math.max(w, Math.exp(-(dev * dev) / (2 * sigma * sigma)));
      // μ 子一路都在发光：环里面也落着光，越靠外越亮
      if (ring === 'mu' && ang < CHERENKOV) w = Math.max(w, 0.22 * (ang / CHERENKOV) ** 2);
    }
    // 电子的簇射：毛一点，随机丢掉一些
    if (ring === 'e' && hash(`${key}${i}e`) < 0.35) w *= 0.3;
    // 低能电子：只有零星的几十颗
    if (ring === 'low') w = hash(`${key}${i}l`) < 0.16 ? w * (0.5 + hash(`${key}${i}m`) * 0.5) : 0;
    if (w < 0.1) continue;
    raw.push({ i, w, dist });
    dmin = Math.min(dmin, dist);
    dmax = Math.max(dmax, dist);
  }
  // 光到得有先有后：离顶点越远越晚（放慢了很多倍，好看得见）
  for (const r of raw) hits.push({ i: r.i, w: r.w, delay: dmax > dmin ? ((r.dist - dmin) / (dmax - dmin)) * 0.28 : 0 });
  return { ring, center: hitWall(v, d1), hits };
}

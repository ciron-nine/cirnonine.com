/**
 * PROTOTYPE（首页第五轮 A）：蓝晒图纸上的 Dadras 吸引子（四翼）。
 * ẋ = y − a·x + b·y·z，ẏ = c·y − x·z + z，ż = d·x·y − e·z；四片翅膀绕着两根轴缠，有体积，不是一团球。
 * 先积分出一条很长的轨道，在上面取几千个起点各积分一小段，得到几千条流线；
 * 每条流线上有一颗亮点沿着它走、身后拖一段渐隐的尾巴，整个吸引子看起来一直在流。
 * 镜头慢慢绕着转，滚动时多转一点。减少动态效果时只画一帧。
 */
import { Camera, Geometry, Mesh, Program, Renderer, Transform } from 'ogl';

export const DADRAS = { a: 3, b: 2.7, c: 1.7, d: 2, e: 9 };

function step([x, y, z]: number[], dt: number): number[] {
  const { a, b, c, d, e } = DADRAS;
  const f = ([x, y, z]: number[]) => [y - a * x + b * y * z, c * y - x * z + z, d * x * y - e * z];
  // 四阶龙格-库塔
  const k1 = f([x, y, z]);
  const k2 = f([x + (k1[0] * dt) / 2, y + (k1[1] * dt) / 2, z + (k1[2] * dt) / 2]);
  const k3 = f([x + (k2[0] * dt) / 2, y + (k2[1] * dt) / 2, z + (k2[2] * dt) / 2]);
  const k4 = f([x + k3[0] * dt, y + k3[1] * dt, z + k3[2] * dt]);
  return [0, 1, 2].map((i) => [x, y, z][i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

function streamlines(count: number, length: number) {
  const dt = 0.006;
  let p = [1.1, 2.1, -2];
  for (let i = 0; i < 4000; i++) p = step(p, dt);
  const seeds: number[][] = [];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 37; k++) p = step(p, dt);
    seeds.push([p[0] + (Math.random() - 0.5) * 0.6, p[1] + (Math.random() - 0.5) * 0.6, p[2] + (Math.random() - 0.5) * 0.6]);
  }
  const verts = count * length * 2;
  const position = new Float32Array(verts * 3);
  const along = new Float32Array(verts);
  const seed = new Float32Array(verts);
  let v = 0;
  for (let s = 0; s < count; s++) {
    let q = seeds[s];
    const r = Math.random();
    for (let i = 0; i < length; i++) {
      const n = step(q, dt * 2);
      for (const [pt, t] of [
        [q, i / length],
        [n, (i + 1) / length],
      ] as const) {
        position.set([pt[0] * 0.075, pt[2] * 0.075, (pt[1] + 1.9) * 0.075], v * 3);
        along[v] = t;
        seed[v] = r;
        v++;
      }
      q = n;
    }
  }
  return { position, along, seed };
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute float along;
  attribute float seed;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  varying float vGlow;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 亮点沿流线走：head 是这条线上亮点现在的位置，身后 0.35 长的尾巴渐隐
    float head = fract(uTime * (0.08 + seed * 0.06) + seed * 7.0);
    float d = head - along;
    float tail = d >= 0.0 ? exp(-d * 9.0) : 0.0;
    vGlow = 0.03 + tail * 0.75;
    vDepth = clamp((-mv.z - 2.0) / 4.0, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uPulse;
  varying float vGlow;
  varying float vDepth;
  void main() {
    // 蓝晒：越亮越接近纸白，远处淡
    vec3 white = vec3(0.86, 0.92, 0.97);
    vec3 cyan = vec3(0.45, 0.68, 0.92);
    vec3 col = mix(cyan, white, vGlow) * vGlow * mix(1.0, 0.45, vDepth) * (1.0 + uPulse * 0.4);
    // 画布是透明的，透明度跟着亮度走：暗的线淡下去，而不是在蓝纸上变成黑线
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
  }
`;

export function mountAttractor(canvas: HTMLCanvasElement, opts: { still: boolean; scroll: () => number }) {
  const small = Math.min(innerWidth, innerHeight) < 600;
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, dpr: Math.min(devicePixelRatio, 1.5), alpha: true, antialias: true });
  } catch {
    return null;
  }
  const { gl } = renderer;
  if (!gl) return null;
  const camera = new Camera(gl, { fov: 40, near: 0.1, far: 50 });
  const scene = new Transform();
  const data = streamlines(small ? 1400 : 3200, small ? 60 : 80);
  const time = { value: 0 };
  const mesh = new Mesh(gl, {
    mode: gl.LINES,
    geometry: new Geometry(gl, {
      position: { size: 3, data: data.position },
      along: { size: 1, data: data.along },
      seed: { size: 1, data: data.seed },
    }),
    program: new Program(gl, {
      vertex,
      fragment,
      uniforms: { uTime: time, uPulse: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  });
  mesh.program.setBlendFunc(gl.ONE, gl.ONE);
  mesh.frustumCulled = false;
  mesh.setParent(scene);

  const resize = () => {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.perspective({ aspect: width / height });
  };
  resize();
  addEventListener('resize', resize);

  let raf = 0;
  let t = 0;
  let last = performance.now();
  let spin = 0;
  const draw = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!opts.still) t += dt;
    time.value = t;
    // 绕着转：时间转得慢，滚动多转一点
    spin += (opts.scroll() * 2.4 - spin) * 0.06;
    const a = t * 0.05 + spin + 0.6;
    camera.position.set(Math.sin(a) * 5.2, 1.2 + Math.sin(t * 0.07) * 0.4, Math.cos(a) * 5.2);
    camera.lookAt([0, 0, 0]);
    gl.clearColor(0, 0, 0, 0);
    renderer.render({ scene, camera });
    if (!opts.still) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

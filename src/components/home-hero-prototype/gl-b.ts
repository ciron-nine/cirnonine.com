/**
 * PROTOTYPE 变体 B：记录星图的 WebGL 层。星的位置从页面上的 .star 链接读（构建时算好的），
 * 这一层只负责让星有光晕、轻轻闪，背景有一层很淡的、慢慢转的星尘；指向哪颗星，哪颗就亮起来。
 * 原名标签、点击跳转都在 HTML 层，没有 WebGL 时照样能用。
 */
import { Geometry, Mesh, Program, Transform } from 'ogl';
import { ELLIPSE } from './star-layout';
import { createRenderer, readInk, startLoop, type Mounted, type MountOptions } from './gl-common';

const DUST = 700;

const starVertex = /* glsl */ `
  attribute vec2 position;
  attribute float mag;
  attribute float seed;
  attribute float starIndex;
  uniform float uTime;
  uniform float uDpr;
  uniform float uHover;
  uniform float uScale;
  varying float vMag;
  varying float vTwinkle;
  varying float vHover;
  void main() {
    vHover = abs(starIndex - uHover) < 0.5 ? 1.0 : 0.0;
    vMag = mag;
    vTwinkle = 0.78 + 0.22 * sin(uTime * (0.6 + seed * 1.4) + seed * 40.0);
    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = (6.0 + mag * mag * 30.0) * (1.0 + vHover * 0.9) * uDpr * uScale;
  }
`;

const starFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  varying float vMag;
  varying float vTwinkle;
  varying float vHover;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(p);
    if (d > 1.0) discard;
    float core = smoothstep(0.22, 0.05, d);
    float glow = exp(-d * d * 7.0) * (0.25 + 0.5 * vMag);
    // 心头好带一道细细的十字芒
    float spike = vMag > 0.95 ? (max(0.0, 1.0 - abs(p.x) * 18.0) + max(0.0, 1.0 - abs(p.y) * 18.0)) * (1.0 - d) * 0.6 : 0.0;
    float a = (core + glow + spike) * vTwinkle * (0.55 + 0.45 * vMag) + vHover * glow;
    gl_FragColor = vec4(uInk, clamp(a, 0.0, 1.0));
  }
`;

const dustVertex = /* glsl */ `
  attribute vec2 position;
  attribute float seed;
  uniform float uTime;
  uniform float uDpr;
  uniform vec2 uEllipse;
  varying float vSeed;
  void main() {
    // position 是单位圆里的极坐标 (r, θ)，整体慢慢转，越靠里转得越快一点
    float th = position.y + uTime * (0.004 + 0.01 * (1.0 - position.x));
    vec2 p = vec2(cos(th), -sin(th)) * position.x * uEllipse;
    vSeed = seed;
    gl_Position = vec4(p, 0.0, 1.0);
    gl_PointSize = (1.0 + seed * 1.5) * uDpr;
  }
`;

const dustFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uTime;
  varying float vSeed;
  void main() {
    float a = 0.10 + 0.12 * sin(uTime * 0.5 + vSeed * 50.0);
    gl_FragColor = vec4(uInk, max(a, 0.0));
  }
`;

export function mount({ frame, canvas, still }: MountOptions): Mounted | null {
  const dpr = Math.min(devicePixelRatio, 2);
  const renderer = createRenderer(canvas, { dpr, alpha: true });
  if (!renderer) return null;
  const { gl } = renderer;
  gl.clearColor(0, 0, 0, 0);

  const links = [...frame.querySelectorAll<HTMLAnchorElement>('.star')];
  const n = links.length;
  const position = new Float32Array(n * 2);
  const mag = new Float32Array(n);
  const seed = new Float32Array(n);
  const index = new Float32Array(n);
  links.forEach((link, i) => {
    const rho = Number(link.dataset.rho);
    const theta = Number(link.dataset.theta);
    // 和 CSS 里的 left / top 百分比对应：NDC 是 [-1, 1]，所以半轴乘 2；屏幕 y 朝下
    position[i * 2] = rho * Math.cos(theta) * ELLIPSE.rx * 2;
    position[i * 2 + 1] = -rho * Math.sin(theta) * ELLIPSE.ry * 2;
    mag[i] = Number(link.dataset.mag);
    seed[i] = Math.random();
    index[i] = i;
  });

  const scene = new Transform();
  const ink = { value: readInk(frame) };
  const time = { value: 0 };
  const dprU = { value: dpr };

  const dustPos = new Float32Array(DUST * 2);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 2] = Math.sqrt(Math.random()) * 1.02;
    dustPos[i * 2 + 1] = Math.random() * Math.PI * 2;
    dustSeed[i] = Math.random();
  }
  const dust = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, { position: { size: 2, data: dustPos }, seed: { size: 1, data: dustSeed } }),
    program: new Program(gl, {
      vertex: dustVertex,
      fragment: dustFragment,
      transparent: true,
      depthTest: false,
      uniforms: { uInk: ink, uTime: time, uDpr: dprU, uEllipse: { value: [ELLIPSE.rx * 2, ELLIPSE.ry * 2] } },
    }),
  });
  dust.setParent(scene);

  const hover = { value: -1 };
  const scale = { value: 1 };
  const stars = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, {
      position: { size: 2, data: position },
      mag: { size: 1, data: mag },
      seed: { size: 1, data: seed },
      // 不能叫 index：OGL 会把名为 index 的属性当成索引缓冲
      starIndex: { size: 1, data: index },
    }),
    program: new Program(gl, {
      vertex: starVertex,
      fragment: starFragment,
      transparent: true,
      depthTest: false,
      uniforms: { uInk: ink, uTime: time, uDpr: dprU, uHover: hover, uScale: scale },
    }),
  });
  stars.setParent(scene);

  const loop = startLoop({
    frame,
    renderer,
    still,
    stillTime: 3,
    resize(w, h) {
      // 手机上星图小，星也跟着小一点
      scale.value = Math.min(1, Math.max(0.6, Math.min(w, h) / 600));
    },
    scheme() {
      ink.value = readInk(frame);
    },
    draw(t) {
      time.value = t;
      renderer.render({ scene });
    },
  });

  const controller = new AbortController();
  links.forEach((link, i) => {
    const on = () => {
      hover.value = i;
      loop.redraw();
    };
    const off = () => {
      if (hover.value === i) hover.value = -1;
      loop.redraw();
    };
    link.addEventListener('pointerenter', on, { signal: controller.signal });
    link.addEventListener('focus', on, { signal: controller.signal });
    link.addEventListener('pointerleave', off, { signal: controller.signal });
    link.addEventListener('blur', off, { signal: controller.signal });
  });

  return {
    destroy() {
      controller.abort();
      loop.destroy();
    },
  };
}

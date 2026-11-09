/**
 * PROTOTYPE 变体 A：Hopf 纤维化。S² 上取九圈纬线，每个点的纤维是 S³ 里的一个大圆，球极投影到三维后
 * 是一组互相套着的圆环；整体在四维里转，圆环翻卷、穿插，纬线本身也在慢慢漂。每根纤维上还有几颗珠子顺着流。
 * 公式和 math.ts 的 hopfPoint 一致（那边用来画静态后备）。
 */
import { Geometry, Mesh, Program, Transform } from 'ogl';
import { HOPF } from './math';
import { createRenderer, GLSL_HASH, readColors, startLoop, type Mounted, type MountOptions } from './gl-common';

const BEADS = 5;

const GLSL_HOPF = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform float uFit;
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uDist;

  vec4 fiber(float eta, float phi, float t) {
    vec3 b = vec3(sin(eta) * cos(phi), sin(eta) * sin(phi), cos(eta));
    float k = 1.0 / sqrt(2.0 * (1.0 + b.z));
    return k * vec4((1.0 + b.z) * cos(t), b.x * sin(t) - b.y * cos(t), b.x * cos(t) + b.y * sin(t), (1.0 + b.z) * sin(t));
  }

  // 返回屏幕上的 NDC（xy）、深度（z）和透明度（w）
  vec4 hopf(vec3 param) {
    float ring = param.x;
    float eta = 3.14159265 * (0.2 + 0.6 * ring) + 0.15 * (1.0 + uPulse * 0.6) * sin(uTime * 0.13 + ring * 5.0);
    vec4 q = fiber(eta, param.y + uTime * 0.05 * (ring - 0.5), param.z);
    float a = 0.5 + 0.85 * sin(uTime * 0.07);
    float b = uTime * 0.05;
    vec4 r = vec4(q.x * cos(a) - q.w * sin(a), q.y * cos(b) - q.z * sin(b), q.y * sin(b) + q.z * cos(b), q.x * sin(a) + q.w * cos(a));
    vec3 p = r.xyz / max(1.0 - r.w, 1e-3);
    float alpha = 1.0 - smoothstep(1.8, 4.2, length(p));
    p *= uFit * (1.0 + uPulse * 0.04);

    float yaw = uTime * 0.04 + 0.3;
    float tilt = 0.35 + 0.1 * sin(uTime * 0.05);
    float x = p.x * cos(yaw) + p.z * sin(yaw);
    float z1 = -p.x * sin(yaw) + p.z * cos(yaw);
    float y = p.y * cos(tilt) - z1 * sin(tilt);
    float z = p.y * sin(tilt) + z1 * cos(tilt);
    float k = uDist / (uDist - z);
    vec2 ndc = vec2(x, y) * k * uUnit / uRes;
    return vec4(ndc, z, alpha);
  }
`;

const lineVertex = /* glsl */ `
  attribute vec3 position;
  ${GLSL_HOPF}
  varying float vAlpha;
  varying float vDepth;
  varying float vSeed;
  void main() {
    vec4 h = hopf(position);
    vAlpha = h.w;
    vDepth = h.z;
    vSeed = position.y * 7.0 + position.x * 13.0;
    gl_Position = vec4(h.xy, 0.0, 1.0);
  }
`;

const lineFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uStrength;
  varying float vAlpha;
  varying float vDepth;
  varying float vSeed;
  ${GLSL_HASH}
  void main() {
    // 近处实、远处淡；再随机丢掉一部分像素，留下铅笔一样的颗粒
    float a = vAlpha * uStrength * (0.12 + 0.5 * smoothstep(-1.2, 1.2, vDepth));
    if (hash12(gl_FragCoord.xy + vSeed) > 0.75) discard;
    gl_FragColor = vec4(uInk, a);
  }
`;

const beadVertex = /* glsl */ `
  attribute vec3 position;
  ${GLSL_HOPF}
  uniform float uDpr;
  varying float vAlpha;
  void main() {
    // 珠子沿着纤维走：t 随时间增加，每圈速度不同
    vec4 h = hopf(vec3(position.x, position.y, position.z + uTime * (0.25 + position.x * 0.3)));
    vAlpha = h.w * smoothstep(-1.5, 1.0, h.z);
    gl_Position = vec4(h.xy, 0.0, 1.0);
    gl_PointSize = (1.5 + 1.5 * smoothstep(-1.0, 1.0, h.z)) * uDpr;
  }
`;

const beadFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uStrength;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    gl_FragColor = vec4(uInk, vAlpha * uStrength * (1.0 - d) * 0.9);
  }
`;

export function mount({ frame, canvas, still, pulse }: MountOptions): Mounted | null {
  const renderer = createRenderer(canvas, frame, { maxPixels: 2_400_000 });
  if (!renderer) return null;
  const { gl } = renderer;

  const { rings, fibers, segments } = HOPF;
  const lines = new Float32Array(rings * fibers * segments * 2 * 3);
  const beads = new Float32Array(rings * fibers * BEADS * 3);
  let li = 0;
  let bi = 0;
  for (let r = 0; r < rings; r++) {
    const ring = r / (rings - 1);
    for (let f = 0; f < fibers; f++) {
      // 相邻两圈的纤维错开半格，套在一起更密
      const phi = ((f + (r % 2) * 0.5) / fibers) * Math.PI * 2;
      for (let s = 0; s < segments; s++) {
        for (const t of [s, s + 1]) {
          lines[li++] = ring;
          lines[li++] = phi;
          lines[li++] = (t / segments) * Math.PI * 2;
        }
      }
      for (let b = 0; b < BEADS; b++) {
        beads[bi++] = ring;
        beads[bi++] = phi;
        beads[bi++] = ((b + Math.random() * 0.5) / BEADS) * Math.PI * 2;
      }
    }
  }

  const colors = readColors(frame);
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uFit: { value: HOPF.fit },
    uRes: { value: [1, 1] },
    uUnit: { value: 1 },
    uDist: { value: HOPF.dist },
    uInk: { value: colors.ink },
    uStrength: { value: 1 },
    uDpr: { value: renderer.dpr },
  };
  const scene = new Transform();
  new Mesh(gl, {
    mode: gl.LINES,
    geometry: new Geometry(gl, { position: { size: 3, data: lines } }),
    program: new Program(gl, { vertex: lineVertex, fragment: lineFragment, uniforms, transparent: true, depthTest: false }),
  }).setParent(scene);
  new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, { position: { size: 3, data: beads } }),
    program: new Program(gl, { vertex: beadVertex, fragment: beadFragment, uniforms, transparent: true, depthTest: false }),
  }).setParent(scene);

  let paper = colors.paper;
  gl.clearColor(paper[0], paper[1], paper[2], 1);

  return startLoop({
    frame,
    renderer,
    still,
    pulse,
    stillTime: 0,
    resize(w, h) {
      uniforms.uRes.value = [w, h];
      uniforms.uUnit.value = Math.min(w, h) * 0.65 + Math.max(w, h) * 0.35;
    },
    scheme() {
      const c = readColors(frame);
      uniforms.uInk.value = c.ink;
      paper = c.paper;
      gl.clearColor(paper[0], paper[1], paper[2], 1);
    },
    draw({ time, strength, pulse: level }) {
      uniforms.uTime.value = time;
      uniforms.uStrength.value = strength;
      uniforms.uPulse.value = level;
      renderer.render({ scene });
    },
  });
}

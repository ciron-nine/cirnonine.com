/**
 * PROTOTYPE 变体 A：Aizawa 吸引子，极细的单色线，缓慢自转。
 * 颗粒感来自随机丢弃像素：每条线只留下一部分像素，线越密的地方留下的越多，像铅笔或网版印刷的网点。
 */
import { Geometry, Mesh, Program } from 'ogl';
import { aizawaPoints, FIT, START_ANGLE, TILT } from './aizawa';
import { createRenderer, readInk, startLoop, type Mounted, type MountOptions } from './gl-common';

const POINTS = 160_000;
/** 一圈约两分钟 */
const SPEED = (Math.PI * 2) / 120;

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute float seed;
  uniform float uAngle;
  uniform float uTilt;
  uniform float uAspect;
  uniform float uFit;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float ca = cos(uAngle), sa = sin(uAngle);
    float rx = position.x * ca - position.y * sa;
    float ry = position.x * sa + position.y * ca;
    float ct = cos(uTilt), st = sin(uTilt);
    float sy = position.z * ct - ry * st;
    vDepth = position.z * st + ry * ct;
    vSeed = seed;
    vec2 p = vec2(rx, sy) * uFit;
    if (uAspect > 1.0) p.x /= uAspect; else p.y *= uAspect;
    gl_Position = vec4(p, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uDensity;
  varying float vDepth;
  varying float vSeed;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  void main() {
    // 近处的线更实，远处的淡
    float keep = uDensity * (0.12 + 0.88 * smoothstep(-0.9, 0.9, vDepth));
    if (hash(vec3(gl_FragCoord.xy, vSeed * 113.0)) > keep) discard;
    gl_FragColor = vec4(uInk, 1.0);
  }
`;

export function mount({ frame, canvas, still }: MountOptions): Mounted | null {
  const renderer = createRenderer(canvas, { dpr: Math.min(devicePixelRatio, 2), alpha: true });
  if (!renderer) return null;
  const { gl } = renderer;
  gl.clearColor(0, 0, 0, 0);

  const seeds = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) seeds[i] = Math.random();
  const geometry = new Geometry(gl, {
    position: { size: 3, data: aizawaPoints(POINTS) },
    seed: { size: 1, data: seeds },
  });
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    depthTest: false,
    uniforms: {
      uAngle: { value: START_ANGLE },
      uTilt: { value: TILT },
      uAspect: { value: 2 },
      uFit: { value: FIT },
      uInk: { value: readInk(frame) },
      uDensity: { value: 0.5 },
    },
  });
  const mesh = new Mesh(gl, { geometry, program, mode: gl.LINE_STRIP });

  const loop = startLoop({
    frame,
    renderer,
    still,
    stillTime: 0,
    resize(w, h) {
      program.uniforms.uAspect.value = w / h;
      // 屏幕越小、像素越少，线挤得越密：按短边调低留下的比例，手机上不至于糊成一团
      program.uniforms.uDensity.value = Math.min(0.4, 0.04 + Math.min(w, h) / 1600);
    },
    scheme() {
      program.uniforms.uInk.value = readInk(frame);
    },
    draw(t) {
      program.uniforms.uAngle.value = START_ANGLE + t * SPEED;
      renderer.render({ scene: mesh });
    },
  });
  return loop;
}

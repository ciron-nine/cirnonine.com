/**
 * PROTOTYPE 变体 C：会变形的参数曲面。细线网格在 Klein 瓶、Boy 曲面、Enneper 极小曲面之间缓慢变形，
 * 每种停留一阵再变成下一种；网格上还有一层波纹在走。公式和 math.ts 的 surfacePoint 一致。
 *
 * 选它而不是三维谐波图：谐波图是一根线，铺满背景时像一团乱麻；网格曲面有面的感觉，变形时最「数学」。
 */
import { Geometry, Mesh, Program } from 'ogl';
import { SURFACE } from './math';
import { createRenderer, GLSL_HASH, readColors, startLoop, type Mounted, type MountOptions } from './gl-common';

const vertex = /* glsl */ `
  attribute vec2 position;
  uniform float uTime;
  uniform float uPulse;
  uniform float uFit;
  uniform float uPeriod;
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uDist;
  varying float vDepth;
  varying float vSeed;
  const float TAU = 6.2831853;

  vec3 klein(vec2 uv) {
    float U = uv.x * TAU, V = uv.y * TAU;
    float c = cos(U * 0.5), s = sin(U * 0.5);
    float w = 2.0 + c * sin(V) - s * sin(2.0 * V);
    return vec3(w * cos(U), s * sin(V) + c * sin(2.0 * V), w * sin(U)) / 3.0;
  }
  vec3 boy(vec2 uv) {
    float U = uv.x * 3.14159265, V = uv.y * 3.14159265;
    float cv = cos(V);
    float d = 2.0 - 1.41421356 * sin(3.0 * U) * sin(2.0 * V);
    float x = (1.41421356 * cv * cv * cos(2.0 * U) + cos(U) * sin(2.0 * V)) / d;
    float y = (1.41421356 * cv * cv * sin(2.0 * U) - sin(U) * sin(2.0 * V)) / d;
    float z = 3.0 * cv * cv / d;
    return vec3(x, z - 1.1, y) / 1.4;
  }
  vec3 enneper(vec2 uv) {
    float r = uv.y * 1.5, th = uv.x * TAU;
    float x = r * cos(th) - r * r * r * cos(3.0 * th) / 3.0;
    float y = -r * sin(th) - r * r * r * sin(3.0 * th) / 3.0;
    float z = r * r * cos(2.0 * th);
    return vec3(x, z, y) / 2.4;
  }

  void main() {
    float phase = mod(uTime / uPeriod, 3.0);
    float i = floor(phase);
    float f = smoothstep(0.55, 1.0, phase - i);
    vec3 w = vec3(0.0);
    if (i < 0.5) w = vec3(1.0 - f, f, 0.0);
    else if (i < 1.5) w = vec3(0.0, 1.0 - f, f);
    else w = vec3(f, 0.0, 1.0 - f);

    vec2 uv = position;
    float ripple = 1.0 + 0.05 * (1.0 + uPulse * 1.5) * sin(uv.x * TAU * 4.0 + uTime * 1.1) * sin(uv.y * TAU * 3.0 - uTime * 0.8);
    vec3 p = (w.x * klein(uv) + w.y * boy(uv) + w.z * enneper(uv)) * ripple * uFit;

    float yaw = uTime * 0.06 + 0.4;
    float tilt = 0.45 + 0.15 * sin(uTime * 0.07);
    float x = p.x * cos(yaw) + p.z * sin(yaw);
    float z1 = -p.x * sin(yaw) + p.z * cos(yaw);
    float y = p.y * cos(tilt) - z1 * sin(tilt);
    float z = p.y * sin(tilt) + z1 * cos(tilt);
    float k = uDist / (uDist - z);
    vDepth = z;
    vSeed = uv.x * 31.0 + uv.y * 17.0;
    gl_Position = vec4(vec2(x, y) * k * uUnit / uRes, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uStrength;
  varying float vDepth;
  varying float vSeed;
  ${GLSL_HASH}
  void main() {
    float a = uStrength * (0.1 + 0.55 * smoothstep(-0.9, 0.9, vDepth));
    if (hash12(gl_FragCoord.xy + vSeed) > 0.8) discard;
    gl_FragColor = vec4(uInk, a);
  }
`;

export function mount({ frame, canvas, still, pulse }: MountOptions): Mounted | null {
  const renderer = createRenderer(canvas, frame, { maxPixels: 2_400_000 });
  if (!renderer) return null;
  const { gl } = renderer;

  const { lines, segments } = SURFACE;
  const data = new Float32Array(2 * lines * segments * 2 * 2);
  let n = 0;
  for (let l = 0; l < lines; l++) {
    const fixed = l / lines;
    for (let s = 0; s < segments; s++) {
      for (const t of [s / segments, (s + 1) / segments]) {
        // 沿 u 的线（v 固定）
        data[n++] = t;
        data[n++] = fixed;
      }
      for (const t of [s / segments, (s + 1) / segments]) {
        // 沿 v 的线（u 固定）
        data[n++] = fixed;
        data[n++] = t;
      }
    }
  }

  const colors = readColors(frame);
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uFit: { value: SURFACE.fit },
    uPeriod: { value: SURFACE.period },
    uRes: { value: [1, 1] },
    uUnit: { value: 1 },
    uDist: { value: SURFACE.dist },
    uInk: { value: colors.ink },
    uStrength: { value: 1 },
  };
  const mesh = new Mesh(gl, {
    mode: gl.LINES,
    geometry: new Geometry(gl, { position: { size: 2, data } }),
    program: new Program(gl, { vertex, fragment, uniforms, transparent: true, depthTest: false }),
  });
  gl.clearColor(colors.paper[0], colors.paper[1], colors.paper[2], 1);

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
      gl.clearColor(c.paper[0], c.paper[1], c.paper[2], 1);
    },
    draw({ time, strength, pulse: level }) {
      uniforms.uTime.value = time;
      uniforms.uStrength.value = strength;
      uniforms.uPulse.value = level;
      renderer.render({ scene: mesh });
    },
  });
}

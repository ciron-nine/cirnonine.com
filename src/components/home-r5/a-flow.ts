/**
 * PROTOTYPE（首页第六轮 A）：蓝晒图纸上的 Dequan Li 吸引子，用粒子流画。
 * ẋ = a(y − x) + d·x·z，ẏ = k·x + f·y − x·z，ż = c·z + x·y − e·x²（a = 40, c = 1.833, d = 0.16, e = 0.65, k = 55, f = 20）。
 * 正面看是层层叠叠的一个曲面，中间一道收腰；换过 Dadras（大部分时间在一个旋涡里打转，看起来偏向一边）、
 * Halvorsen（这组参数下收成一条周期轨道）、Sprott（一个球），都不如它。镜头只在正面左右 ±0.45 的范围里摆。
 *
 * 十几万个粒子在 GPU 上沿这个向量场流（浮点纹理里存位置，每帧推进几小步）；
 * 粒子以加法画进一张「墨量」纹理，每帧先让旧的墨量衰减一点，留下来的就是尾迹。
 * 吸引子的形状由粒子的疏密自己显出来，整个画面一直在流。粒子寿命到了就在吸引子附近随便找个地方重生，
 * 被吸回去的路上画出一条条汇入的流线。
 * 合成时按墨量在青和纸白之间取色，画布是透明的，背后的蓝晒纸和方格照样露出来。
 * 要 WebGL2 和可渲染的浮点纹理；没有时返回 null，页面上只有蓝晒纸。
 */
import { GPGPU, Geometry, Mesh, Program, Renderer, RenderTarget, Triangle } from 'ogl';

const HASH = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

const simFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uDt;
  uniform float uAge;
  uniform float uTime;
  varying vec2 vUv;
  ${HASH}
  vec3 field(vec3 p) {
    return vec3(40.0 * (p.y - p.x) + 0.16 * p.x * p.z, 55.0 * p.x - p.x * p.z + 20.0 * p.y, 1.833 * p.z + p.x * p.y - 0.65 * p.x * p.x);
  }
  void main() {
    vec4 s = texture2D(tMap, vUv);
    vec3 p = s.xyz;
    // 寿命按秒算
    float life = s.w - uAge;
    // 四小步 RK2：这个吸引子跑得很快（速度上万），一大步会飞出去
    for (int i = 0; i < 4; i++) {
      vec3 k1 = field(p);
      p += field(p + k1 * uDt * 0.5) * uDt;
    }
    if (life < 0.0 || dot(p, p) > 250000.0) {
      // 重生到另一个随机粒子身边：它已经在吸引子上，新粒子一出生就在形状里，不会在画面上散成一层雾
      vec2 seed = vUv * 517.0 + uTime;
      vec3 other = texture2D(tMap, vec2(hash12(seed), hash12(seed + 7.3))).xyz;
      p = other + (vec3(hash12(seed + 1.1), hash12(seed + 2.2), hash12(seed + 3.3)) - 0.5) * 2.0;
      life = 6.0 + hash12(seed + 4.4) * 18.0;
    }
    gl_FragColor = vec4(p, life);
  }
`;

const particleVertex = /* glsl */ `
  attribute vec2 coords;
  uniform sampler2D tPos;
  uniform float uHalfTexel;
  uniform float uYaw;
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uDpr;
  varying float vBright;
  void main() {
    vec4 s = texture2D(tPos, coords + uHalfTexel);
    // 竖直方向用 z（中心在 z ≈ 99），深度方向用 y
    vec3 p = vec3(s.x, s.z - 99.0, s.y) * 0.0037;
    float c = cos(uYaw), sn = sin(uYaw);
    float x = p.x * c + p.z * sn;
    float z1 = -p.x * sn + p.z * c;
    float tilt = 0.1;
    float y = p.y * cos(tilt) - z1 * sin(tilt);
    float z = p.y * sin(tilt) + z1 * cos(tilt);
    float k = 4.2 / (4.2 - z);
    gl_Position = vec4(vec2(x, y) * k * uUnit / uRes, 0.0, 1.0);
    // 刚重生的粒子先淡一点；近处亮，远处暗
    float fadeIn = smoothstep(0.0, 0.5, s.w);
    vBright = fadeIn * (0.55 + 0.45 * smoothstep(-1.0, 1.0, z));
    gl_PointSize = uDpr;
  }
`;

const particleFragment = /* glsl */ `
  precision highp float;
  uniform float uInk;
  varying float vBright;
  void main() {
    gl_FragColor = vec4(vec3(uInk * vBright), 1.0);
  }
`;

const quadVertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const decayFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tPrev;
  uniform float uDecay;
  varying vec2 vUv;
  void main() {
    // 尾迹存在半精度浮点纹理里，只乘衰减系数就行：稀薄的流线不会被 8 位精度吃掉
    gl_FragColor = vec4(vec3(texture2D(tPrev, vUv).r * uDecay), 1.0);
  }
`;

const compositeFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tTrail;
  varying vec2 vUv;
  void main() {
    float d = texture2D(tTrail, vUv).r;
    // 开平方压一下：核心很密、翅膀很稀，两边都要看得见
    float ink = 1.0 - exp(-sqrt(d) * 1.5);
    // 稀的地方是青，密的地方接近纸白；画布透明，透明度就是墨量
    vec3 col = mix(vec3(0.42, 0.66, 0.92), vec3(0.93, 0.97, 1.0), smoothstep(0.25, 0.9, ink));
    gl_FragColor = vec4(col * ink, ink);
  }
`;

export function mountFlow(canvas: HTMLCanvasElement, opts: { still: boolean; scroll: () => number }) {
  const small = Math.min(innerWidth, innerHeight) < 600;
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, dpr: Math.min(devicePixelRatio, 1.5), alpha: true, premultipliedAlpha: true, webgl: 2 });
  } catch {
    return null;
  }
  const { gl } = renderer;
  if (!gl || !renderer.isWebgl2 || !gl.getExtension('EXT_color_buffer_float')) {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const side = small ? 256 : 400;
  const count = side * side;
  const initial = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    initial[i * 4] = (Math.random() - 0.5) * 260;
    initial[i * 4 + 1] = (Math.random() - 0.5) * 340;
    initial[i * 4 + 2] = (Math.random() - 0.2) * 260;
    initial[i * 4 + 3] = Math.random() * 24;
  }
  const sim = new GPGPU(gl, { data: initial, type: gl.FLOAT });
  // 每帧走 4 × 0.00005：粒子每帧只挪几个像素，尾迹连成线而不是一串点
  const simUniforms = { uDt: { value: 0.00005 }, uAge: { value: 0 }, uTime: { value: 0 } };
  sim.addPass({ fragment: simFragment, uniforms: simUniforms });

  const uniforms = {
    tPos: sim.uniform,
    uHalfTexel: { value: 0.5 / sim.size },
    uYaw: { value: 0.6 },
    uRes: { value: [1, 1] },
    uUnit: { value: 1 },
    uDpr: { value: renderer.dpr },
    uInk: { value: small ? 0.022 : 0.013 },
  };
  const particles = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, { coords: { size: 2, data: sim.coords } }),
    program: new Program(gl, { vertex: particleVertex, fragment: particleFragment, uniforms, transparent: true, depthTest: false, depthWrite: false }),
  });
  particles.program.setBlendFunc(gl.ONE, gl.ONE);

  const triangle = new Triangle(gl);
  const gl2 = gl as WebGL2RenderingContext;
  const trailTarget = () =>
    new RenderTarget(gl, { width: 2, height: 2, depth: false, type: gl2.HALF_FLOAT, internalFormat: gl2.RGBA16F, format: gl2.RGBA });
  let trails = [trailTarget(), trailTarget()];
  const decayUniforms = { tPrev: { value: trails[0].texture }, uDecay: { value: 0.95 } };
  const decay = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, { vertex: quadVertex, fragment: decayFragment, uniforms: decayUniforms, depthTest: false }),
  });
  const compositeUniforms = { tTrail: { value: trails[1].texture } };
  const composite = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, { vertex: quadVertex, fragment: compositeFragment, uniforms: compositeUniforms, depthTest: false }),
  });

  const drawTrail = () => {
    const [prev, next] = trails;
    decayUniforms.tPrev.value = prev.texture;
    renderer.render({ scene: decay, target: next, clear: false });
    renderer.render({ scene: particles, target: next, clear: false });
    compositeUniforms.tTrail.value = next.texture;
    gl.clearColor(0, 0, 0, 0);
    renderer.render({ scene: composite });
    trails = [next, prev];
  };

  const resize = () => {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();
    renderer.setSize(width, height);
    uniforms.uRes.value = [width, height];
    uniforms.uUnit.value = Math.min(width, height) * 0.62 + Math.max(width, height) * 0.2;
    for (const t of trails) t.setSize(Math.round(width * renderer.dpr), Math.round(height * renderer.dpr));
  };
  resize();
  addEventListener('resize', resize);

  // 开头先空跑一段，让粒子落到吸引子上
  let time = 0;
  simUniforms.uAge.value = 0;
  for (let i = 0; i < 4000; i++) {
    simUniforms.uTime.value = (time += 0.001);
    sim.render();
  }

  let raf = 0;
  let last = performance.now();
  let spin = 0;
  uniforms.uYaw.value = 0;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    simUniforms.uTime.value = time;
    simUniforms.uAge.value = dt;
    sim.render();
    spin += (opts.scroll() * 1.2 - spin) * 0.06;
    // 只在最好看的角度附近来回摆：转到侧面时这个吸引子会扁成一条线
    uniforms.uYaw.value = Math.sin(time * 0.07) * 0.45 + spin * 0.3;
    drawTrail();
    raf = requestAnimationFrame(frame);
  };
  if (opts.still) {
    // 只画一帧：叠几十帧尾迹，静态画面和动起来时一样浓
    simUniforms.uAge.value = 0.016;
    for (let i = 0; i < 50; i++) {
      simUniforms.uTime.value = (time += 0.016);
      sim.render();
      drawTrail();
    }
  } else {
    raf = requestAnimationFrame(frame);
  }

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

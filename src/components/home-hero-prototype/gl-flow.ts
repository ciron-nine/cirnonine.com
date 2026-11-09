/**
 * PROTOTYPE 变体 B：吸引子粒子流。十几万个粒子沿着 Thomas 吸引子的向量场流动，拖着渐隐的尾迹。
 *
 * 选 Thomas：dx = sin y − bx, dy = sin z − by, dz = sin x − bz。三个方向对称，粒子在一格格的「笼子」之间跳，
 * 流线密而均匀，铺成背景最好看；Halvorsen 是三片尖叶，四翼吸引子是一团，都更像一个物件。
 * 参数 b 随时间在 0.17–0.21 之间漂移，吸引子的形状跟着松紧变化。
 *
 * 渲染分三步：GPGPU 在浮点纹理里推进粒子位置；粒子以加法画进一张「墨量」纹理，每帧先让旧的墨量衰减，就是尾迹；
 * 最后按墨量在纸色和墨色之间插值画到屏幕上，所以浅色模式是纸上的墨，深色模式是黑底上的光。
 *
 * 数据层：前 N 个粒子对应 N 条记录，画得大一点、亮一点，心头好更亮（只是一种质感，背景上不能点）。
 */
import { GPGPU, Geometry, Mesh, Program, RenderTarget, Triangle } from 'ogl';
import { THOMAS, thomasB } from './math';
import { createRenderer, GLSL_HASH, readColors, startLoop, type Mounted, type MountOptions } from './gl-common';

const simFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uDt;
  uniform float uB;
  uniform float uTime;
  varying vec2 vUv;
  ${GLSL_HASH}
  vec3 field(vec3 p) { return vec3(sin(p.y) - uB * p.x, sin(p.z) - uB * p.y, sin(p.x) - uB * p.z); }
  void main() {
    vec4 s = texture2D(tMap, vUv);
    vec3 p = s.xyz;
    float life = s.w - uDt;
    // RK2
    vec3 k1 = field(p);
    p += field(p + k1 * uDt * 0.5) * uDt;
    if (life < 0.0) {
      // 寿命到了就在一个大方块里随便找个地方重生，新粒子会被吸过去，形成一条条汇入的流
      vec2 seed = vUv * 517.0 + uTime;
      p = (vec3(hash12(seed), hash12(seed + 19.1), hash12(seed + 47.7)) - 0.5) * 9.0;
      life = 4.0 + hash12(seed + 3.3) * 10.0;
    }
    gl_FragColor = vec4(p, life);
  }
`;

const particleVertex = /* glsl */ `
  attribute vec2 coords;
  attribute float record;
  uniform sampler2D tPos;
  uniform float uHalfTexel;
  uniform float uTime;
  uniform float uFit;
  uniform float uDist;
  uniform vec2 uRes;
  uniform float uUnit;
  uniform float uDpr;
  uniform float uPulse;
  varying float vBright;
  void main() {
    vec4 s = texture2D(tPos, coords + uHalfTexel);
    vec3 p = s.xyz * uFit * (1.0 + uPulse * 0.03);
    float yaw = uTime * 0.03 + 0.7;
    float tilt = 0.55;
    float x = p.x * cos(yaw) + p.z * sin(yaw);
    float z1 = -p.x * sin(yaw) + p.z * cos(yaw);
    float y = p.y * cos(tilt) - z1 * sin(tilt);
    float z = p.y * sin(tilt) + z1 * cos(tilt);
    float k = uDist / (uDist - z);
    gl_Position = vec4(vec2(x, y) * k * uUnit / uRes, 0.0, 1.0);
    // 寿命快到时淡出；刚重生的粒子不隐藏，它们被吸向吸引子时画出一条条汇入的流线
    float fadeIn = smoothstep(0.0, 0.6, s.w);
    float depth = 0.45 + 0.55 * smoothstep(-1.0, 1.0, z);
    vBright = fadeIn * depth * (record > 0.0 ? 0.6 + record * 1.4 : 1.0);
    gl_PointSize = (record > 0.0 ? 2.0 + record * 2.5 : 1.0) * uDpr;
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
    // 8 位纹理里只乘系数会卡在最低一档消不掉：再减一点
    float d = texture2D(tPrev, vUv).r;
    gl_FragColor = vec4(vec3(max(d * uDecay - 0.004, 0.0)), 1.0);
  }
`;

const compositeFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tTrail;
  uniform vec3 uInkColor;
  uniform vec3 uPaper;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;
  ${GLSL_HASH}
  void main() {
    float d = texture2D(tTrail, vUv).r;
    float ink = (1.0 - exp(-d * 2.2)) * uStrength;
    vec3 col = mix(uPaper, uInkColor, ink);
    col += (hash12(gl_FragCoord.xy + fract(uTime * 13.0) * 100.0) - 0.5) * 0.03;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function mount({ frame, canvas, still, pulse, records }: MountOptions): Mounted | null {
  // 尾迹是整屏的一张纹理，分辨率压低一点；粒子本来就是一个个像素点，看不出来
  const renderer = createRenderer(canvas, frame, { maxPixels: 1_400_000, maxDpr: 1.5 });
  if (!renderer) return null;
  const { gl } = renderer;
  // 粒子位置要存在浮点纹理里，而且要能渲染进去：只在 WebGL2 + 浮点颜色缓冲上做，否则停在静态后备
  if (!renderer.isWebgl2 || !gl.getExtension('EXT_color_buffer_float')) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const small = Math.min(innerWidth, innerHeight) < 600;
  const side = small ? 256 : 384;
  const count = side * side;
  const initial = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    initial[i * 4] = (Math.random() - 0.5) * 9;
    initial[i * 4 + 1] = (Math.random() - 0.5) * 9;
    initial[i * 4 + 2] = (Math.random() - 0.5) * 9;
    initial[i * 4 + 3] = Math.random() * 14;
  }
  const sim = new GPGPU(gl, { data: initial, type: gl.FLOAT });
  const simUniforms = { uDt: { value: 0 }, uB: { value: thomasB(0) }, uTime: { value: 0 } };
  sim.addPass({ fragment: simFragment, uniforms: simUniforms });

  // 前几个粒子是记录：1 = 心头好，其余记录约 0.4
  const recordAttr = new Float32Array(count);
  records.forEach((mag, i) => {
    recordAttr[i * Math.floor(count / Math.max(records.length, 1))] = mag;
  });

  const colors = readColors(frame);
  const uniforms = {
    tPos: sim.uniform,
    uHalfTexel: { value: 0.5 / sim.size },
    uTime: { value: 0 },
    uFit: { value: THOMAS.fit },
    uDist: { value: THOMAS.dist },
    uRes: { value: [1, 1] },
    uUnit: { value: 1 },
    uDpr: { value: renderer.dpr },
    uPulse: { value: 0 },
    // 粒子数越多每颗越淡，总墨量差不多
    uInk: { value: small ? 0.1 : 0.09 },
  };
  const particles = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, {
      coords: { size: 2, data: sim.coords },
      record: { size: 1, data: recordAttr },
    }),
    program: new Program(gl, {
      vertex: particleVertex,
      fragment: particleFragment,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  });
  particles.program.setBlendFunc(gl.ONE, gl.ONE);

  const triangle = new Triangle(gl);
  let trails = [new RenderTarget(gl, { width: 2, height: 2, depth: false }), new RenderTarget(gl, { width: 2, height: 2, depth: false })];
  const decayUniforms = { tPrev: { value: trails[0].texture }, uDecay: { value: 0.9 } };
  const decay = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, { vertex: quadVertex, fragment: decayFragment, uniforms: decayUniforms, depthTest: false }),
  });
  const compositeUniforms = {
    tTrail: { value: trails[1].texture },
    uInkColor: { value: colors.ink },
    uPaper: { value: colors.paper },
    uStrength: { value: 1 },
    uTime: { value: 0 },
  };
  const composite = new Mesh(gl, {
    geometry: triangle,
    program: new Program(gl, { vertex: quadVertex, fragment: compositeFragment, uniforms: compositeUniforms, depthTest: false }),
  });

  /** 推进 n 步模拟（减少动态效果时一次推很多步，直接画出成形的样子） */
  const step = (dt: number, time: number) => {
    simUniforms.uDt.value = dt;
    simUniforms.uTime.value = time;
    simUniforms.uB.value = thomasB(time);
    sim.render();
  };

  const drawTrail = (decayFactor: number) => {
    const [prev, next] = trails;
    decayUniforms.tPrev.value = prev.texture;
    decayUniforms.uDecay.value = decayFactor;
    renderer.render({ scene: decay, target: next, clear: false });
    renderer.render({ scene: particles, target: next, clear: false });
    compositeUniforms.tTrail.value = next.texture;
    renderer.render({ scene: composite });
    trails = [next, prev];
  };

  let warmed = false;

  return startLoop({
    frame,
    renderer,
    still,
    pulse,
    stillTime: 0,
    resize(w, h) {
      uniforms.uRes.value = [w, h];
      uniforms.uUnit.value = Math.min(w, h) * 0.65 + Math.max(w, h) * 0.35;
      const pw = Math.round(w * renderer.dpr);
      const ph = Math.round(h * renderer.dpr);
      for (const t of trails) t.setSize(pw, ph);
      warmed = false;
    },
    scheme() {
      const c = readColors(frame);
      compositeUniforms.uInkColor.value = c.ink;
      compositeUniforms.uPaper.value = c.paper;
    },
    draw({ time, dt, strength, pulse: level }) {
      uniforms.uTime.value = time;
      uniforms.uPulse.value = level;
      compositeUniforms.uStrength.value = strength;
      compositeUniforms.uTime.value = time;
      if (!warmed) {
        // 开头先空跑一段，让粒子落到吸引子上，再开始画尾迹
        for (let i = 0; i < (still ? 220 : 90); i++) step(0.05, time);
        if (still) {
          // 只画一帧：按平时的衰减叠几十帧尾迹，静态画面和动起来时一样浓，也有流线
          for (let i = 0; i < 40; i++) {
            step(0.03, time);
            drawTrail(0.9);
          }
        }
        warmed = true;
        if (still) {
          compositeUniforms.tTrail.value = trails[0].texture;
          renderer.render({ scene: composite });
          return;
        }
      }
      if (dt === 0) {
        // 尺寸、配色、滚动变化时的重画：只按当前尾迹重新合成，不再往上叠粒子
        compositeUniforms.tTrail.value = trails[0].texture;
        renderer.render({ scene: composite });
        return;
      }
      step(Math.min(dt, 0.05) * (1.2 + level * 0.8), time);
      drawTrail(0.9);
    },
  });
}

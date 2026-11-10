/**
 * PROTOTYPE（第四轮）：首页的宇宙背景。小册子合着时是一整片星空；翻开第一页时镜头停在带环的行星旁边，
 * 翻到第二页时穿过星云、落在数据生成的星系上方（滚动进度见 cosmos.ts）。
 *
 * 首页固定是夜里（ADR-0004：强度只用在首页）。颜色来自真实的天文图像：
 * - 恒星按光谱型上色（cosmos-math.ts 的 starColor），红矮星最多、最暗，蓝白的少而亮，最亮的几颗有衍射芒
 * - 银河：一道斜穿天空的光带，中间有暗尘带，靠银心的一端偏金，零星有电离氢的玫红
 * - 星云：氧的青和氢的玫红两种气
 * - 气态巨行星：赭、奶、锈三色的条纹在流，环是暖灰
 * - 星系：核心金色，旋臂蓝白，旋臂上零星有玫红的恒星形成区；每条记录是一颗更亮的白星，心头好最亮
 * - 第一屏偶尔有一颗流星
 */
import { Camera, Geometry, Mesh, Program, RenderTarget, Transform, Triangle } from 'ogl';
import {
  BAND_CENTER,
  BAND_NORMAL,
  cameraAt,
  galaxyParticles,
  GALAXY,
  NEBULA,
  PLANET,
  seeded,
  starfield,
  STAR_STRIDE,
  type Vec3,
} from './cosmos-math';
import { createRenderer, GLSL_NOISE, startLoop, type Mounted, type MountOptions } from './gl-common';

const starVertex = /* glsl */ `
  attribute vec3 position;
  attribute float mag;
  attribute vec3 color;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uDpr;
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vColor;
  varying float vSpike;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float tw = 0.75 + 0.25 * sin(uTime * (0.7 + mag * 2.3) + position.x * 3.1 + position.y);
    vColor = color * (0.18 + mag * 1.1) * tw * (1.0 + uPulse * 0.4 * mag);
    // 最亮的几颗有衍射芒，点要画大一些
    vSpike = smoothstep(0.82, 0.95, mag);
    float size = (1.1 + mag * 2.4) * (1.0 + vSpike * 4.0);
    gl_PointSize = size * uDpr * clamp(35.0 / dist, 1.0, 3.0);
  }
`;

const starFragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vSpike;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float core = exp(-d * (vSpike > 0.0 ? 22.0 : 4.5));
    float halo = vSpike * 0.18 * exp(-d * 3.0);
    // 十字衍射芒
    float spike = vSpike * (exp(-abs(p.x) * 40.0) + exp(-abs(p.y) * 40.0)) * (1.0 - sqrt(d)) * 0.6;
    gl_FragColor = vec4(vColor * (core + halo + spike), 1.0);
  }
`;

/** 银河：画在整屏上，按视线方向和银河大圆的夹角算亮度 */
const skyFragment = /* glsl */ `
  precision highp float;
  uniform mat4 uCamWorld;
  uniform vec2 uTan;
  uniform vec3 uNormal;
  uniform vec3 uE1;
  uniform vec3 uE2;
  uniform vec3 uCenter;
  uniform float uGain;
  uniform float uPulse;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 dir = normalize((uCamWorld * vec4(ndc.x * uTan.x, ndc.y * uTan.y, -1.0, 0.0)).xyz);
    float lat = dot(dir, uNormal);
    float lon = atan(dot(dir, uE2), dot(dir, uE1));
    float clump = fbm(vec2(lon * 3.0, lat * 9.0));
    float fine = fbm(vec2(lon * 11.0 + 7.0, lat * 34.0));
    float core = exp(-pow(lat / 0.12, 2.0));
    float wide = exp(-pow(lat / 0.3, 2.0));
    // 暗尘带：沿光带中线一条弯弯曲曲的暗线，被噪声撕成一段一段
    float lane = exp(-pow((lat - 0.025 * sin(lon * 3.0 + 1.0)) / 0.05, 2.0));
    float dust = lane * smoothstep(0.32, 0.62, fbm(vec2(lon * 6.0 + 3.0, lat * 20.0)));
    // 光带本身是一团团的星云，不是均匀的雾：用 clump 把亮度压成一块一块
    float lumpy = smoothstep(0.32, 0.85, clump);
    float density = (core * (0.15 + 1.2 * lumpy) * (0.7 + 0.6 * fine) + wide * 0.06 * fine) * (1.0 - 0.95 * dust);
    float toward = pow(max(dot(dir, uCenter), 0.0), 5.0);
    vec3 cool = vec3(0.42, 0.55, 1.0);
    vec3 warm = vec3(1.0, 0.72, 0.4);
    vec3 col = mix(cool, warm, clamp(toward * 0.9 + clump * 0.25, 0.0, 1.0)) * density * (0.5 + toward * 0.9);
    // 电离氢的玫红小团，和氧的青色薄雾
    col += vec3(0.95, 0.34, 0.46) * smoothstep(0.74, 0.86, fine) * core * 0.55;
    col += vec3(0.22, 0.62, 0.66) * wide * smoothstep(0.45, 0.8, clump) * 0.12;
    gl_FragColor = vec4(col * 0.3 * uGain * (1.0 + uPulse * 0.3), 1.0);
  }
`;

const galaxyVertex = /* glsl */ `
  attribute vec3 position;
  attribute float bright;
  attribute float radius;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uDpr;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uTilt;
  uniform float uPulse;
  varying vec3 vColor;
  varying float vSpike;
  void main() {
    // 较差自转：越靠里转得越快
    float a = uTime * (0.006 + 0.02 / (0.25 + radius));
    vec3 p = vec3(position.x * cos(a) - position.z * sin(a), position.y, position.x * sin(a) + position.z * cos(a));
    float c = cos(uTilt), s = sin(uTilt);
    vec3 w = uCenter + vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c) * uRadius;
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    bool record = bright > 1.0;
    float h = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 core = vec3(1.0, 0.78, 0.46);
    vec3 arm = vec3(0.62, 0.74, 1.0);
    vec3 col = mix(core, arm, smoothstep(0.06, 0.45, radius));
    if (!record && h < 0.035 && radius > 0.18) col = vec3(1.0, 0.38, 0.52);
    float tw = record ? 0.85 + 0.15 * sin(uTime * 1.3 + position.x * 40.0) : 1.0;
    float b = record ? 0.8 + (bright - 1.0) * 0.8 : bright * 0.85;
    vColor = (record ? vec3(1.0, 0.97, 0.92) : col) * b * tw * (1.0 + uPulse * 0.5);
    vSpike = record ? smoothstep(1.5, 1.9, bright) : 0.0;
    float size = record ? 2.6 + (bright - 1.0) * 4.0 : 1.0 + bright * 1.2;
    gl_PointSize = size * (1.0 + vSpike * 2.0) * uDpr * clamp(70.0 / dist, 0.8, 6.0);
  }
`;

const nebulaVertex = /* glsl */ `
  attribute vec3 center;
  attribute vec2 corner;
  attribute float size;
  attribute float seed;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vec4 mv = viewMatrix * vec4(center, 1.0);
    mv.xy += corner * size;
    vUv = corner;
    vSeed = seed;
    gl_Position = projectionMatrix * mv;
  }
`;

const nebulaFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;
  varying float vSeed;
  ${GLSL_NOISE}
  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    vec2 p = vUv * 1.6 + vSeed * 7.0;
    // 两次扭曲的分形噪声，像一缕缕的气
    vec2 q = vec2(fbm(p + uTime * 0.015), fbm(p + 5.2 - uTime * 0.01));
    float n = fbm(p + 2.5 * q);
    float wisp = smoothstep(0.35, 0.95, n) * pow(1.0 - r, 1.6);
    // 氧的青在里，氢的玫红在外
    vec3 teal = vec3(0.26, 0.74, 0.78);
    vec3 rose = vec3(0.9, 0.36, 0.48);
    vec3 col = mix(teal, rose, smoothstep(0.3, 0.75, q.x + r * 0.4));
    gl_FragColor = vec4(col * wisp * 0.34 * (1.0 + uPulse * 0.6), 1.0);
  }
`;

const planetVertex = /* glsl */ `
  attribute vec2 corner;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec3 uCenter;
  uniform float uExtent;
  varying vec3 vView;
  void main() {
    vec4 mv = viewMatrix * vec4(uCenter, 1.0);
    mv.xy += corner * uExtent;
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const planetFragment = /* glsl */ `
  precision highp float;
  uniform mat4 viewMatrix;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uRingIn;
  uniform float uRingOut;
  uniform vec3 uAxis;
  uniform vec3 uLight;
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vView;
  ${GLSL_NOISE}

  float sphere(vec3 o, vec3 d, vec3 c, float r) {
    vec3 oc = o - c;
    float b = dot(oc, d);
    float h = b * b - dot(oc, oc) + r * r;
    if (h < 0.0) return -1.0;
    return -b - sqrt(h);
  }
  float ringDensity(float x) {
    float bands = 0.55 + 0.45 * noise(vec2(x * 60.0, 1.0));
    float gap = smoothstep(0.58, 0.6, x) * (1.0 - smoothstep(0.64, 0.66, x));
    return bands * (1.0 - gap * 0.9) * smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.95, 1.0, x));
  }
  // 条纹的三种颜色：锈、赭、奶
  vec3 bandColor(float t) {
    vec3 rust = vec3(0.6, 0.33, 0.22);
    vec3 ochre = vec3(0.82, 0.6, 0.36);
    vec3 cream = vec3(0.93, 0.86, 0.7);
    return t < 0.5 ? mix(rust, ochre, t * 2.0) : mix(ochre, cream, t * 2.0 - 1.0);
  }

  void main() {
    vec3 d = normalize(vView);
    vec3 c = (viewMatrix * vec4(uCenter, 1.0)).xyz;
    vec3 axis = normalize(mat3(viewMatrix) * uAxis);
    vec3 L = normalize(mat3(viewMatrix) * uLight);
    float R = uRadius;

    float ts = sphere(vec3(0.0), d, c, R);
    float denom = dot(d, axis);
    float tr = abs(denom) > 1e-4 ? dot(c, axis) / denom : -1.0;
    vec3 hr = d * tr;
    float rr = length(hr - c) / R;
    bool ring = tr > 0.0 && rr > uRingIn && rr < uRingOut;
    float ringX = (rr - uRingIn) / (uRingOut - uRingIn);

    vec3 col = vec3(0.0);
    float alpha = 0.0;

    if (ts > 0.0) {
      vec3 P = d * ts;
      vec3 N = (P - c) / R;
      vec3 e1 = normalize(cross(axis, abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 e2 = cross(axis, e1);
      float lat = dot(N, axis);
      float lon = atan(dot(N, e2), dot(N, e1)) + uTime * 0.04;
      float flow = fbm(vec2(lon * 1.5 + uTime * 0.05 * sign(sin(lat * 9.0)), lat * 14.0));
      float band = 0.5 + 0.5 * sin(lat * 22.0 + flow * 3.0);
      vec3 tone = bandColor(band) * (0.8 + 0.2 * fbm(vec2(lon * 4.0, lat * 40.0)));
      float diffuse = max(dot(N, L), 0.0);
      col = tone * (0.025 + 0.975 * diffuse) * (0.55 + 0.45 * pow(max(dot(N, -d), 0.0), 0.5));
      float denomL = dot(L, axis);
      if (abs(denomL) > 1e-4) {
        float tl = dot(c - P, axis) / denomL;
        if (tl > 0.0) {
          float rq = length(P + L * tl - c) / R;
          if (rq > uRingIn && rq < uRingOut) col *= 1.0 - 0.6 * ringDensity((rq - uRingIn) / (uRingOut - uRingIn));
        }
      }
      alpha = 1.0;
    } else {
      // 球外一圈很薄的蓝色大气光
      vec3 oc = -c;
      float b = dot(oc, d);
      float miss = sqrt(max(dot(oc, oc) - b * b, 0.0)) / R - 1.0;
      float rim = exp(-miss * 18.0) * 0.3 * (1.0 + uPulse);
      col = vec3(0.55, 0.72, 0.95) * rim;
      alpha = rim;
    }

    if (ring && (ts < 0.0 || tr < ts)) {
      float dens = ringDensity(ringX);
      float shadow = sphere(hr, L, c, R) > 0.0 ? 0.15 : 1.0;
      vec3 ringCol = mix(vec3(0.62, 0.55, 0.46), vec3(0.88, 0.82, 0.7), noise(vec2(ringX * 25.0, 3.0)));
      vec3 lit = ringCol * dens * (0.3 + 0.7 * abs(dot(axis, L))) * shadow * 0.95;
      float ringA = dens * 0.85;
      col = mix(col, lit, ringA);
      alpha = max(alpha, ringA);
    }
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(col / max(alpha, 1e-3), alpha);
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

const compositeFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tLight;
  uniform vec3 uNight;
  uniform float uTime;
  uniform float uPulse;
  uniform float uAspect;
  uniform vec4 uMeteor;
  uniform float uMeteorT;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main() {
    vec3 l = texture2D(tLight, vUv).rgb * (1.0 + uPulse * 0.25);
    vec3 col = 1.0 - exp(-l * 1.7);
    // 流星：一段从头到尾渐亮的细线，头上一点白
    if (uMeteorT >= 0.0) {
      vec2 a = uMeteor.xy, b = uMeteor.zw;
      vec2 head = mix(a, b, uMeteorT);
      vec2 tail = mix(a, b, max(uMeteorT - 0.28, 0.0));
      vec2 scale = vec2(uAspect, 1.0);
      vec2 pa = (vUv - tail) * scale, ba = (head - tail) * scale;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float dist = length(pa - ba * h);
      float fade = sin(3.14159 * uMeteorT);
      float streak = exp(-dist * 1400.0) * h * h * fade;
      col += vec3(0.85, 0.92, 1.0) * streak * 1.3 + vec3(1.0) * exp(-length((vUv - head) * scale) * 600.0) * fade;
    }
    col = uNight + col * (1.0 - uNight);
    col += (hash12(gl_FragCoord.xy + fract(uTime * 13.0) * 100.0) - 0.5) * 0.025;
    float v = smoothstep(1.3, 0.4, length(vUv - 0.5) * 1.6);
    col = mix(uNight, col, mix(0.7, 1.0, v));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function additive(gl: WebGL2RenderingContext | WebGLRenderingContext, program: Program) {
  program.setBlendFunc(gl.ONE, gl.ONE);
  return program;
}

const NIGHT: Vec3 = [0x04 / 255, 0x06 / 255, 0x11 / 255];

export function mount({ frame, canvas, still, pulse, records, progress, onPulse }: MountOptions): Mounted | null {
  const small = Math.min(innerWidth, innerHeight) < 600;
  const renderer = createRenderer(canvas, frame, { maxPixels: small ? 700_000 : 1_800_000, maxDpr: 1.5 });
  if (!renderer) return null;
  const { gl } = renderer;
  const dprU = { value: renderer.dpr };
  const time = { value: 0 };
  const pulseU = { value: 0 };

  const camera = new Camera(gl, { fov: 50, near: 0.1, far: 1200 });
  const scene = new Transform();
  const common = { transparent: true, depthTest: false, depthWrite: false };

  // 银河：整屏一张三角形，最先画
  const lonForward: Vec3 = (() => {
    const v: Vec3 = [-0.05, 0.05, -1];
    const k = v[0] * BAND_NORMAL[0] + v[1] * BAND_NORMAL[1] + v[2] * BAND_NORMAL[2];
    const p: Vec3 = [v[0] - BAND_NORMAL[0] * k, v[1] - BAND_NORMAL[1] * k, v[2] - BAND_NORMAL[2] * k];
    const l = Math.hypot(...p);
    return [p[0] / l, p[1] / l, p[2] / l];
  })();
  const n = BAND_NORMAL;
  const lonSide: Vec3 = [
    n[1] * lonForward[2] - n[2] * lonForward[1],
    n[2] * lonForward[0] - n[0] * lonForward[2],
    n[0] * lonForward[1] - n[1] * lonForward[0],
  ];
  const skyUniforms = {
    uCamWorld: { value: camera.worldMatrix },
    uTan: { value: [1, 1] },
    uNormal: { value: BAND_NORMAL },
    // 经度从正前方量起，接缝在镜头背后
    uE1: { value: lonForward },
    uE2: { value: lonSide },
    uCenter: { value: BAND_CENTER },
    uGain: { value: 1 },
    uPulse: pulseU,
  };
  const sky = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: quadVertex, fragment: skyFragment, uniforms: skyUniforms, depthTest: false, depthWrite: false }),
  });

  // 背景星空
  const stars = starfield(small ? 6000 : 14000);
  const count = stars.length / STAR_STRIDE;
  const starPos = new Float32Array(count * 3);
  const starMag = new Float32Array(count);
  const starCol = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i * STAR_STRIDE;
    starPos.set(stars.subarray(o, o + 3), i * 3);
    starMag[i] = stars[o + 3];
    starCol.set(stars.subarray(o + 4, o + 7), i * 3);
  }
  const starMesh = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, {
      position: { size: 3, data: starPos },
      mag: { size: 1, data: starMag },
      color: { size: 3, data: starCol },
    }),
    program: new Program(gl, { vertex: starVertex, fragment: starFragment, uniforms: { uDpr: dprU, uTime: time, uPulse: pulseU }, ...common }),
  });

  // 星系
  const galaxy = galaxyParticles(small ? 24_000 : 60_000, records);
  const gn = galaxy.length / 5;
  const gPos = new Float32Array(gn * 3);
  const gBright = new Float32Array(gn);
  const gRadius = new Float32Array(gn);
  for (let i = 0; i < gn; i++) {
    gPos.set(galaxy.subarray(i * 5, i * 5 + 3), i * 3);
    gBright[i] = galaxy[i * 5 + 3];
    gRadius[i] = galaxy[i * 5 + 4];
  }
  const galaxyMesh = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, {
      position: { size: 3, data: gPos },
      bright: { size: 1, data: gBright },
      radius: { size: 1, data: gRadius },
    }),
    program: new Program(gl, {
      vertex: galaxyVertex,
      fragment: starFragment,
      uniforms: {
        uDpr: dprU,
        uTime: time,
        uPulse: pulseU,
        uCenter: { value: GALAXY.center },
        uRadius: { value: GALAXY.radius },
        uTilt: { value: GALAXY.tilt },
      },
      ...common,
    }),
  });

  // 星云：几层朝向镜头的方块
  const clouds = [
    [0, 0, 0, 1],
    [-4, 2, -3, 0.7],
    [5, -1.5, 2, 0.65],
    [2, 3, -6, 0.8],
    [-3, -3, 4, 0.55],
    [6, 2.5, -2, 0.5],
  ];
  const nCenter: number[] = [];
  const nCorner: number[] = [];
  const nSize: number[] = [];
  const nSeed: number[] = [];
  clouds.forEach(([dx, dy, dz, s], i) => {
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
      nCenter.push(NEBULA.center[0] + dx, NEBULA.center[1] + dy, NEBULA.center[2] + dz);
      nCorner.push(cx, cy);
      nSize.push(NEBULA.size * s);
      nSeed.push(i * 1.37);
    }
  });
  const nebulaMesh = new Mesh(gl, {
    geometry: new Geometry(gl, {
      center: { size: 3, data: new Float32Array(nCenter) },
      corner: { size: 2, data: new Float32Array(nCorner) },
      size: { size: 1, data: new Float32Array(nSize) },
      seed: { size: 1, data: new Float32Array(nSeed) },
    }),
    program: new Program(gl, { vertex: nebulaVertex, fragment: nebulaFragment, uniforms: { uTime: time, uPulse: pulseU }, ...common }),
  });

  // 行星：一个朝向镜头的方块，边长盖住整个光环
  const corners = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
  const axis = [Math.sin(PLANET.tilt), Math.cos(PLANET.tilt), 0.25];
  const planetMesh = new Mesh(gl, {
    geometry: new Geometry(gl, { corner: { size: 2, data: corners } }),
    program: new Program(gl, {
      vertex: planetVertex,
      fragment: planetFragment,
      uniforms: {
        uCenter: { value: PLANET.center },
        uExtent: { value: PLANET.radius * PLANET.ringOuter * 1.05 },
        uRadius: { value: PLANET.radius },
        uRingIn: { value: PLANET.ringInner },
        uRingOut: { value: PLANET.ringOuter },
        uAxis: { value: axis },
        uLight: { value: [0.9, 0.35, 0.5] },
        uTime: time,
        uPulse: pulseU,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  });

  additive(gl, sky.program);
  sky.frustumCulled = false;
  sky.setParent(scene);
  for (const mesh of [starMesh, nebulaMesh, galaxyMesh]) {
    additive(gl, mesh.program);
    mesh.frustumCulled = false;
    mesh.setParent(scene);
  }
  planetMesh.frustumCulled = false;
  planetMesh.setParent(scene);

  const light = new RenderTarget(gl, { width: 2, height: 2, depth: false });
  const compositeUniforms = {
    tLight: { value: light.texture },
    uNight: { value: NIGHT },
    uTime: time,
    uPulse: pulseU,
    uAspect: { value: 1 },
    uMeteor: { value: [0, 0, 0, 0] },
    uMeteorT: { value: -1 },
  };
  const composite = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: quadVertex, fragment: compositeFragment, uniforms: compositeUniforms, depthTest: false }),
  });

  // 流星：只在第一屏（小册子还合着的时候），隔 5–13 秒一颗，从右上往左下划
  const rand = seeded(17);
  let meteorAt = still ? Infinity : 3;
  let meteorStart = -1;
  const METEOR_SECONDS = 1.1;

  let shown = still ? 0 : progress();
  let aspect = 1;

  return startLoop({
    frame,
    renderer,
    still,
    pulse,
    stillTime: 12,
    onPulse,
    resize(w, h) {
      aspect = w / h;
      camera.perspective({ aspect });
      const t = Math.tan(((50 / 2) * Math.PI) / 180);
      skyUniforms.uTan.value = [t * aspect, t];
      compositeUniforms.uAspect.value = aspect;
      light.setSize(Math.round(w * renderer.dpr), Math.round(h * renderer.dpr));
    },
    draw({ time: t, dt, pulse: level }) {
      time.value = t;
      pulseU.value = level;
      if (!still) {
        const target = progress();
        shown += (target - shown) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 1);
      }
      const cam = cameraAt(shown);
      if (aspect < 1) {
        const back = 1 + (1 - aspect) * 0.9;
        for (let c = 0; c < 3; c++) cam.pos[c] = cam.target[c] + (cam.pos[c] - cam.target[c]) * back;
      }
      const sway = still ? 0 : 0.25;
      camera.position.set(cam.pos[0] + Math.sin(t * 0.13) * sway, cam.pos[1] + Math.sin(t * 0.09) * sway * 0.6, cam.pos[2]);
      camera.lookAt(cam.target);
      camera.updateMatrixWorld();
      // 飞进星系时银河淡一点，让出画面
      skyUniforms.uGain.value = 1 - 0.75 * Math.min(Math.max(shown - 1, 0), 1);

      if (meteorStart < 0 && t >= meteorAt && shown < 0.4) {
        meteorStart = t;
        const x = 0.35 + rand() * 0.6;
        const y = 0.62 + rand() * 0.33;
        const len = 0.18 + rand() * 0.16;
        compositeUniforms.uMeteor.value = [x, y, x - len * 0.9, y - len * 0.55];
      }
      if (meteorStart >= 0) {
        const u = (t - meteorStart) / METEOR_SECONDS;
        if (u >= 1) {
          meteorStart = -1;
          meteorAt = t + 5 + rand() * 8;
          compositeUniforms.uMeteorT.value = -1;
        } else {
          compositeUniforms.uMeteorT.value = u;
        }
      }

      gl.clearColor(0, 0, 0, 1);
      renderer.render({ scene, camera, target: light });
      renderer.render({ scene: composite });
    },
  });
}

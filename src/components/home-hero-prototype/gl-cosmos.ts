/**
 * PROTOTYPE（第三轮）：首页的宇宙背景。滚动就是镜头在宇宙里往前推，三摊小册子各停在一个星体旁边。
 *
 * 画面先画进一张「亮度」纹理（黑底上发光），再按亮度在外壳的纸色和墨色之间插值画到屏幕上：
 * 深色模式是黑底上的光，浅色模式是纸上的墨，像一张天文版画。
 *
 * 星体：
 * - 背景星空：远处一层球壳几乎不动，近处一层散在镜头经过的路上，有视差
 * - 带环的气态巨行星：一个朝向镜头的方块里做光线和球、环平面求交，条纹在流、慢慢自转，环和球互相投影
 * - 星云：几层朝向镜头的方块，片元里画扭曲的分形噪声，慢慢飘
 * - 三体问题的 8 字形周期轨道：三颗星沿同一条曲线追逐，相位差三分之一周期，拖着光的尾迹
 * - 数据生成的螺旋星系：对数螺线的四条旋臂，一个类别一条；每条记录是旋臂上一颗更亮的星，心头好最亮
 * 黑洞和引力透镜太费 GPU，不做。
 */
import { Camera, Geometry, Mesh, Program, RenderTarget, Transform, Triangle } from 'ogl';
import {
  cameraAt,
  figureEight,
  FIGURE8_PERIOD,
  galaxyParticles,
  GALAXY,
  NEBULA,
  PLANET,
  starfield,
  threeBodyToWorld,
} from './cosmos-math';
import { createRenderer, GLSL_NOISE, readColors, startLoop, type Mounted, type MountOptions } from './gl-common';

const starVertex = /* glsl */ `
  attribute vec3 position;
  attribute float mag;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uDpr;
  uniform float uTime;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float tw = 0.7 + 0.3 * sin(uTime * (0.8 + mag * 2.0) + position.x * 3.1);
    vBright = (0.25 + mag * 0.75) * tw;
    // 近处的星随距离变大，远处的球壳保持一两个像素
    gl_PointSize = (1.0 + mag * 2.0) * uDpr * clamp(35.0 / dist, 1.0, 3.0);
  }
`;

const pointFragment = /* glsl */ `
  precision highp float;
  uniform float uGain;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float a = exp(-d * 4.0) * vBright * uGain;
    gl_FragColor = vec4(vec3(a), 1.0);
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
  varying float vBright;
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
    float tw = record ? 0.85 + 0.15 * sin(uTime * 1.3 + position.x * 40.0) : 1.0;
    vBright = (record ? 0.55 + (bright - 1.0) * 0.6 : bright * 0.5) * tw * (1.0 + uPulse * 0.5);
    float size = record ? 2.5 + (bright - 1.0) * 4.0 : 1.0 + bright * 1.2;
    gl_PointSize = size * uDpr * clamp(70.0 / dist, 0.8, 6.0);
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
    float a = wisp * 0.28 * (1.0 + uPulse * 0.6);
    gl_FragColor = vec4(vec3(a), 1.0);
  }
`;

const trailVertex = /* glsl */ `
  attribute vec3 position;
  attribute float phase;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uPhase;
  varying float vTrail;
  void main() {
    // 三颗星的相位各差三分之一；每颗身后拖三分之一圈的尾迹，越远越淡
    float t = 0.0;
    for (int k = 0; k < 3; k++) {
      float d = fract(uPhase + float(k) / 3.0 - phase);
      t = max(t, pow(max(1.0 - d / 0.32, 0.0), 2.0));
    }
    vTrail = t;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragment = /* glsl */ `
  precision highp float;
  uniform float uGain;
  varying float vTrail;
  void main() {
    gl_FragColor = vec4(vec3(vTrail * 0.9 * uGain), 1.0);
  }
`;

const bodyVertex = /* glsl */ `
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uDpr;
  uniform float uPulse;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vBright = 1.0;
    gl_PointSize = (10.0 + uPulse * 8.0) * uDpr * clamp(14.0 / -mv.z, 0.4, 3.0);
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

  // 光线（从原点出发，方向 d）和球的第一个交点；没交到返回 -1
  float sphere(vec3 o, vec3 d, vec3 c, float r) {
    vec3 oc = o - c;
    float b = dot(oc, d);
    float h = b * b - dot(oc, oc) + r * r;
    if (h < 0.0) return -1.0;
    return -b - sqrt(h);
  }
  float ringDensity(float x) {
    // x 是 0..1 的环半径；一道 Cassini 缝，其余是细细的同心纹
    float bands = 0.55 + 0.45 * noise(vec2(x * 60.0, 1.0));
    float gap = smoothstep(0.58, 0.6, x) * (1.0 - smoothstep(0.64, 0.66, x));
    return bands * (1.0 - gap * 0.9) * smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.95, 1.0, x));
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

    float lum = 0.0;
    float alpha = 0.0;

    if (ts > 0.0) {
      vec3 P = d * ts;
      vec3 N = (P - c) / R;
      vec3 e1 = normalize(cross(axis, abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 e2 = cross(axis, e1);
      float lat = dot(N, axis);
      float lon = atan(dot(N, e2), dot(N, e1)) + uTime * 0.04;
      // 条纹：按纬度分带，带子之间有被拉长的涡流，随时间往一个方向流
      float flow = fbm(vec2(lon * 1.5 + uTime * 0.05 * sign(sin(lat * 9.0)), lat * 14.0));
      float band = 0.5 + 0.5 * sin(lat * 22.0 + flow * 3.0);
      float tone = mix(0.45, 1.0, band) * (0.8 + 0.2 * fbm(vec2(lon * 4.0, lat * 40.0)));
      float diffuse = max(dot(N, L), 0.0);
      lum = tone * (0.03 + 0.97 * diffuse) * (0.55 + 0.45 * pow(max(dot(N, -d), 0.0), 0.5));
      // 环落在球上的影子
      float denomL = dot(L, axis);
      if (abs(denomL) > 1e-4) {
        float tl = dot(c - P, axis) / denomL;
        if (tl > 0.0) {
          float rq = length(P + L * tl - c) / R;
          if (rq > uRingIn && rq < uRingOut) lum *= 1.0 - 0.6 * ringDensity((rq - uRingIn) / (uRingOut - uRingIn));
        }
      }
      alpha = 1.0;
    } else {
      // 球外一圈很薄的大气光
      vec3 oc = -c;
      float b = dot(oc, d);
      float miss = sqrt(max(dot(oc, oc) - b * b, 0.0)) / R - 1.0;
      float rim = exp(-miss * 18.0) * 0.25 * (1.0 + uPulse);
      lum = rim;
      alpha = rim;
    }

    if (ring && (ts < 0.0 || tr < ts)) {
      float dens = ringDensity(ringX);
      // 球落在环上的影子
      float shadow = sphere(hr, L, c, R) > 0.0 ? 0.15 : 1.0;
      float ringLum = dens * (0.3 + 0.7 * abs(dot(axis, L))) * shadow * 0.9;
      float ringA = dens * 0.85;
      lum = mix(lum, ringLum, ringA);
      alpha = max(alpha, ringA);
    }
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(vec3(lum / max(alpha, 1e-3)), alpha);
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
  uniform vec3 uInk;
  uniform vec3 uPaper;
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;
  ${GLSL_NOISE}
  void main() {
    float l = texture2D(tLight, vUv).r * (1.0 + uPulse * 0.25);
    float ink = 1.0 - exp(-l * 1.8);
    vec3 col = mix(uPaper, uInk, ink);
    // 胶片颗粒和一点暗角
    col += (hash12(gl_FragCoord.xy + fract(uTime * 13.0) * 100.0) - 0.5) * 0.03;
    float v = smoothstep(1.25, 0.45, length(vUv - 0.5) * 1.6);
    col = mix(uPaper, col, mix(0.75, 1.0, v));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function additive(gl: WebGL2RenderingContext | WebGLRenderingContext, program: Program) {
  program.setBlendFunc(gl.ONE, gl.ONE);
  return program;
}

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

  // 背景星空
  const stars = starfield(small ? 2500 : 5000);
  const starPos = new Float32Array((stars.length / 4) * 3);
  const starMag = new Float32Array(stars.length / 4);
  for (let i = 0; i < starMag.length; i++) {
    starPos.set(stars.subarray(i * 4, i * 4 + 3), i * 3);
    starMag[i] = stars[i * 4 + 3];
  }
  const starMesh = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, { position: { size: 3, data: starPos }, mag: { size: 1, data: starMag } }),
    program: new Program(gl, { vertex: starVertex, fragment: pointFragment, uniforms: { uDpr: dprU, uTime: time, uGain: { value: 1 } }, ...common }),
  });

  // 星系
  const galaxy = galaxyParticles(small ? 24_000 : 60_000, records);
  const n = galaxy.length / 5;
  const gPos = new Float32Array(n * 3);
  const gBright = new Float32Array(n);
  const gRadius = new Float32Array(n);
  for (let i = 0; i < n; i++) {
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
      fragment: pointFragment,
      uniforms: {
        uDpr: dprU,
        uTime: time,
        uPulse: pulseU,
        uGain: { value: 1 },
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

  // 三体 8 字形轨道
  const SAMPLES = 600;
  const curve = figureEight(SAMPLES);
  const trailPos = new Float32Array((SAMPLES + 1) * 3);
  const trailPhase = new Float32Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const [x, y] = curve[i % SAMPLES];
    trailPos.set(threeBodyToWorld(x, y), i * 3);
    trailPhase[i] = i / SAMPLES;
  }
  const phaseU = { value: 0 };
  const trailMesh = new Mesh(gl, {
    mode: gl.LINE_STRIP,
    geometry: new Geometry(gl, { position: { size: 3, data: trailPos }, phase: { size: 1, data: trailPhase } }),
    program: new Program(gl, { vertex: trailVertex, fragment: trailFragment, uniforms: { uPhase: phaseU, uGain: { value: 1 } }, ...common }),
  });
  const bodyPos = new Float32Array(9);
  const bodyGeometry = new Geometry(gl, { position: { size: 3, data: bodyPos } });
  const bodyMesh = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: bodyGeometry,
    program: new Program(gl, { vertex: bodyVertex, fragment: pointFragment, uniforms: { uDpr: dprU, uPulse: pulseU, uGain: { value: 1.2 } }, ...common }),
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

  for (const mesh of [starMesh, nebulaMesh, galaxyMesh, trailMesh, bodyMesh]) {
    additive(gl, mesh.program);
    mesh.frustumCulled = false;
    mesh.setParent(scene);
  }
  planetMesh.frustumCulled = false;
  planetMesh.setParent(scene);

  const light = new RenderTarget(gl, { width: 2, height: 2, depth: false });
  const colors = readColors(frame);
  const compositeUniforms = {
    tLight: { value: light.texture },
    uInk: { value: colors.ink },
    uPaper: { value: colors.paper },
    uTime: time,
    uPulse: pulseU,
  };
  const composite = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: quadVertex, fragment: compositeFragment, uniforms: compositeUniforms, depthTest: false }),
  });

  // 镜头跟着滚动走，但做一点阻尼：滚轮一下一下跳的时候镜头是平滑的
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
      light.setSize(Math.round(w * renderer.dpr), Math.round(h * renderer.dpr));
    },
    scheme() {
      const c = readColors(frame);
      compositeUniforms.uInk.value = c.ink;
      compositeUniforms.uPaper.value = c.paper;
    },
    draw({ time: t, dt, pulse: level }) {
      time.value = t;
      pulseU.value = level;
      if (!still) {
        const target = progress();
        shown += (target - shown) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 1);
      }
      const cam = cameraAt(shown);
      // 竖屏的视野窄：镜头沿视线往后退一点，构图和横屏差不多
      if (aspect < 1) {
        const back = 1 + (1 - aspect) * 0.9;
        for (let c = 0; c < 3; c++) cam.pos[c] = cam.target[c] + (cam.pos[c] - cam.target[c]) * back;
      }
      // 停在某一摊时镜头也不完全静止：绕着看的点轻轻漂
      const sway = still ? 0 : 0.25;
      camera.position.set(cam.pos[0] + Math.sin(t * 0.13) * sway, cam.pos[1] + Math.sin(t * 0.09) * sway * 0.6, cam.pos[2]);
      camera.lookAt(cam.target);

      const phase = (t / FIGURE8_PERIOD) * 0.5;
      phaseU.value = phase % 1;
      for (let k = 0; k < 3; k++) {
        const f = (((phase + k / 3) % 1) + 1) % 1;
        const i = f * SAMPLES;
        const a = curve[Math.floor(i) % SAMPLES];
        const b = curve[(Math.floor(i) + 1) % SAMPLES];
        const u = i - Math.floor(i);
        bodyPos.set(threeBodyToWorld(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), k * 3);
      }
      bodyGeometry.attributes.position.needsUpdate = true;

      gl.clearColor(0, 0, 0, 1);
      renderer.render({ scene, camera, target: light });
      renderer.render({ scene: composite });
    },
  });
}

/**
 * PROTOTYPE（首页第五轮 C）：极夜里的极光，一张全屏着色器。
 * 地平线、两层山影、湖面倒影；天上几层极光帘沿 x 方向流动，里面是竖直的光束：
 * 底边是氧的绿（557.7 nm），往上过渡到氧的红（630 nm），下缘一道氮的紫蓝。星星闪，偶尔一颗流星。
 * 往下滚动时镜头慢慢仰起来：地平线沉下去，最后只剩极光和星空（片尾字幕在星空上滚）。
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAspect;
  uniform float uLook;
  uniform vec4 uMeteor;
  uniform float uMeteorT;
  varying vec2 vUv;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 11.7; a *= 0.5; }
    return v;
  }

  vec3 stars(vec2 p) {
    vec3 col = vec3(0.0);
    for (int k = 0; k < 3; k++) {
      float scale = 60.0 + float(k) * 70.0;
      vec2 g = p * scale;
      vec2 id = floor(g);
      float h = hash(id + float(k) * 17.0);
      if (h > 0.9) {
        vec2 c = id + vec2(hash(id + 3.1), hash(id + 7.7));
        float d = length(g - c);
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
        float b = smoothstep(1.0, 0.0, d * (9.0 + float(k) * 3.0)) * (h - 0.9) * 14.0 * tw;
        vec3 tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash(id + 1.3));
        col += tint * b;
      }
    }
    return col;
  }

  // 极光：几层帘子，每层一条弯弯的底边，底边最亮，往上淡出；里面是竖直的光束
  vec3 aurora(vec2 p) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x = p.x * (0.9 + fi * 0.25) + fi * 3.7;
      // 帘子的底边起伏很大，像一块在风里折叠的布
      float base = 0.14 + fi * 0.1 + 0.28 * fbm(vec2(x * 0.7 + uTime * 0.025, fi)) + 0.05 * sin(x * 1.7 + uTime * 0.15 + fi);
      float h = p.y - base;
      if (h < -0.03) continue;
      float edge = smoothstep(-0.03, 0.004, h);
      float fade = exp(-max(h, 0.0) * (2.6 + fi * 0.8));
      // 竖直的光束：沿 x 很细的条纹，被一层慢慢流的噪声推着走
      float warp = fbm(vec2(x * 2.5, uTime * 0.06 + fi)) * 5.0;
      float rays = 0.4 + 0.6 * pow(fbm(vec2(x * 30.0 + warp, fi * 3.0 + uTime * 0.18)), 1.5) * 1.7;
      // 帘子之间有空隙
      float sheet = smoothstep(0.3, 0.78, fbm(vec2(x * 1.1 - uTime * 0.035, fi * 2.0)));
      float k = edge * fade * rays * sheet;
      vec3 green = vec3(0.32, 1.0, 0.58);
      vec3 red = vec3(0.95, 0.28, 0.42);
      vec3 violet = vec3(0.5, 0.38, 1.0);
      vec3 c = mix(green, red * 0.7, smoothstep(0.18, 0.55, h));
      c = mix(violet, c, smoothstep(-0.01, 0.025, h));
      col += c * k * (0.5 - fi * 0.08);
    }
    return col;
  }

  vec3 sky(vec2 p) {
    // p.y 是离地平线的高度
    vec3 top = vec3(0.012, 0.018, 0.045);
    vec3 low = vec3(0.03, 0.11, 0.14);
    vec3 col = mix(low, top, smoothstep(0.0, 0.7, p.y));
    col += stars(p) * smoothstep(0.0, 0.08, p.y);
    col += aurora(p) * 0.9;
    return col;
  }

  // 带棱线的噪声：山脊是尖的
  float ridged(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * (1.0 - abs(noise(p) * 2.0 - 1.0)); p = p * 2.1 + 5.3; a *= 0.5; }
    return v;
  }
  float ridge(float x, float seed, float amp) {
    return amp * pow(ridged(vec2(x * 1.6 + seed, seed)), 2.2);
  }

  void main() {
    vec2 uv = vUv;
    float horizon = 0.32 - uLook * 0.75;
    vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - horizon);
    vec3 col;
    if (p.y >= 0.0) {
      col = sky(p);
      // 两层山：远山淡、近山黑；山顶被极光照出一点绿
      float far = ridge(p.x, 1.0, 0.2);
      float near = ridge(p.x * 0.8, 4.0, 0.1) + 0.006;
      if (p.y < far) col = mix(col, vec3(0.02, 0.05, 0.07) + aurora(vec2(p.x, 0.25)) * 0.05, 0.92);
      if (p.y < near) col = vec3(0.006, 0.012, 0.02) + vec3(0.1, 0.35, 0.22) * smoothstep(near - 0.01, near, p.y) * 0.25;
    } else {
      // 湖面：天空的倒影，带一点横向的波纹，越近越暗
      float d = -p.y;
      vec2 q = vec2(p.x + sin(d * 180.0 + uTime * 1.4) * 0.004 * d * 6.0, d);
      col = sky(q) * 0.42;
      float near = ridge(p.x * 0.8, 4.0, 0.1) + 0.006;
      if (d < near) col *= 0.3;
      col *= smoothstep(0.55, 0.0, d) * 0.85 + 0.15;
    }
    // 流星
    if (uMeteorT >= 0.0) {
      vec2 a = uMeteor.xy, b = uMeteor.zw;
      vec2 head = mix(a, b, uMeteorT);
      vec2 tail = mix(a, b, max(uMeteorT - 0.3, 0.0));
      vec2 s = vec2(uAspect, 1.0);
      vec2 pa = (uv - tail) * s, ba = (head - tail) * s;
      float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float fade = sin(3.14159 * uMeteorT);
      col += vec3(0.9, 0.95, 1.0) * exp(-length(pa - ba * hh) * 1500.0) * hh * hh * fade * 1.4;
    }
    col = 1.0 - exp(-col * 1.6);
    col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.02;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function mountAurora(canvas: HTMLCanvasElement, opts: { still: boolean; scroll: () => number }) {
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, dpr: innerWidth < 700 ? 1 : Math.min(devicePixelRatio, 1.5) * 0.8, alpha: false });
  } catch {
    return null;
  }
  const { gl } = renderer;
  if (!gl) return null;
  const uniforms = {
    uTime: { value: 20 },
    uAspect: { value: 1 },
    uLook: { value: 0 },
    uMeteor: { value: [0, 0, 0, 0] },
    uMeteorT: { value: -1 },
  };
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex, fragment, uniforms }) });
  const resize = () => {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();
    renderer.setSize(width, height);
    uniforms.uAspect.value = width / height;
  };
  resize();
  addEventListener('resize', resize);

  let raf = 0;
  let last = performance.now();
  let look = opts.scroll();
  let meteorAt = 4;
  let meteorStart = -1;
  const draw = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const t = (uniforms.uTime.value += opts.still ? 0 : dt);
    look += (opts.scroll() - look) * (opts.still ? 1 : 0.08);
    uniforms.uLook.value = look;
    if (!opts.still) {
      if (meteorStart < 0 && t >= meteorAt) {
        meteorStart = t;
        const x = 0.3 + Math.random() * 0.6;
        const y = 0.7 + Math.random() * 0.25;
        uniforms.uMeteor.value = [x, y, x - 0.22, y - 0.14];
      }
      if (meteorStart >= 0) {
        const u = (t - meteorStart) / 1.1;
        if (u >= 1) {
          meteorStart = -1;
          meteorAt = t + 4 + Math.random() * 7;
          uniforms.uMeteorT.value = -1;
        } else uniforms.uMeteorT.value = u;
      }
    }
    renderer.render({ scene: mesh });
    if (!opts.still) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

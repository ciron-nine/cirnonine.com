/**
 * PROTOTYPE（首页第十四轮）：神冈的水池（Kamioka.astro）。three.js 画水罐内部：
 * - 罐壁：黑色的板上一格一格嵌着金色的光电倍增管（InstancedMesh，自己写的着色器：玻璃泡、边缘的反光、被光打中时的蓝白色）
 * - 每条记录是一次事件，各有各的「指纹」（tank.ts：锥角、径迹、锐利程度、两个环的夹角、衰变的回响）。
 *   轮到它时，光锥从环心张开到环边，颜色按光到达的先后从深蓝走到冰白；μ 子事件有一半会在一秒后再亮起一个暗暗的回响
 * - 镜头像在水里缓缓漂着，慢慢转过去看着每一个新的环；拖动可以自己看
 * - 右下角是这一次的事件图（展开的罐壁和上下两个盖子），事件表里每一条也有自己的事件图
 * - 不另外出声：站上本来有背景音乐
 * - 减少动态效果：不自己放事件，点事件表才亮，亮了不淡
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildTank, displayXY, eventFor, hash, HALF_H, R, RING_NAME, type Event, type Tank } from './tank';

interface Rec {
  key: string;
  title: string;
  lang?: 'ja';
  href: string;
  category: string;
  categoryLabel: string;
  date: { precision: string; year?: number; month?: number; day?: number };
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const dateLabel = (d: Rec['date']) =>
  d.precision === 'day' ? `${d.year}年${d.month}月${d.day}日` : d.precision === 'month' ? `${d.year}年${d.month}月` : d.precision === 'year' ? `${d.year}年` : '很久以前';

/** 这一次的指纹写成一行字 */
function sigLine(ev: Event) {
  const parts = [`锥角 ${ev.sig.angle.toFixed(1)}°`];
  if (ev.ring === 'mu') parts.push(`径迹 ${Math.round(ev.sig.fill * 100)}%`);
  if (ev.sig.second) parts.push(`两环相隔 ${Math.round((ev.sig.second * 180) / Math.PI)}°`);
  if (ev.sig.echo) parts.push('有衰变回响');
  parts.push(`${ev.hits.length} 颗管子`);
  return parts.join('　');
}

/** 时间色：最早到的光深蓝，最晚到的冰白（超级神冈的事件图也按到达时间着色） */
function tintRGB(t: number): [number, number, number] {
  const a = [0.12, 0.32, 1.0];
  const b = [0.35, 0.82, 1.0];
  const c = [0.9, 0.97, 1.0];
  const [p, q, k] = t < 0.5 ? [a, b, t * 2] : [b, c, (t - 0.5) * 2];
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
}

/** 画一张事件图：中间是展开的罐壁，上下两个圆是盖子 */
export function drawDisplay(canvas: HTMLCanvasElement, ev: Event, tank: Tank, dpr = 2) {
  const w = canvas.clientWidth || 160;
  const h = canvas.clientHeight || 150;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const unit = Math.min(w / (2 * Math.PI * R), h / (2 * HALF_H + 4 * R + 2));
  const wallW = 2 * Math.PI * R * unit;
  const wallH = 2 * HALF_H * unit;
  const capR = R * unit;
  const left = (w - wallW) / 2;
  const top = (h - wallH - capR * 4) / 2;
  const wallY = top + capR * 2;
  ctx.strokeStyle = 'rgba(160,190,230,0.28)';
  ctx.lineWidth = 0.75;
  ctx.strokeRect(left + 0.5, wallY, wallW - 1, wallH);
  ctx.beginPath();
  ctx.arc(w / 2, top + capR, capR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, wallY + wallH + capR, capR, 0, Math.PI * 2);
  ctx.stroke();
  for (const hit of ev.hits) {
    const [u, v, part] = displayXY(tank, hit.i);
    const [r, g, b] = tintRGB(hit.tint);
    ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.min(1, 0.25 + hit.w).toFixed(2)})`;
    const s = 0.6 + hit.w * 1.4;
    let x: number;
    let y: number;
    if (part === 'wall') {
      x = left + u * wallW;
      y = wallY + v * wallH;
    } else {
      x = w / 2 + u * capR;
      y = (part === 'top' ? top + capR : wallY + wallH + capR) + v * capR * (part === 'top' ? 1 : -1);
    }
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}

const VERT = /* glsl */ `
  attribute float aGlow;
  attribute float aTint;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vGlow;
  varying float vTint;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vGlow = aGlow;
    vTint = aTint;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uCam;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vGlow;
  varying float vTint;
  vec3 tint(float t) {
    vec3 a = vec3(0.12, 0.32, 1.0);
    vec3 b = vec3(0.35, 0.82, 1.0);
    vec3 c = vec3(0.9, 0.97, 1.0);
    return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
  }
  void main() {
    vec3 v = normalize(uCam - vWorld);
    float ndv = max(dot(vNormal, v), 0.0);
    float fres = pow(1.0 - ndv, 4.0);
    // 金色的光阴极：中间深、边缘一圈亮的反光，正中一点镜头方向的高光
    vec3 gold = vec3(0.55, 0.38, 0.14);
    vec3 col = gold * (0.05 + 0.3 * pow(ndv, 3.0));
    col += vec3(0.95, 0.78, 0.48) * fres * 0.35;
    col += vec3(1.0, 0.9, 0.7) * pow(ndv, 120.0) * 0.5;
    // 水里一点点流动的反光，让墙不是死的
    float shimmer = 0.5 + 0.5 * sin(vWorld.y * 0.9 + uTime * 0.6 + sin(vWorld.x * 0.5 + uTime * 0.3) * 2.0);
    col += vec3(0.05, 0.1, 0.16) * shimmer * fres;
    // 被切伦科夫光打中
    col += tint(vTint) * vGlow * 3.4;
    float d = length(uCam - vWorld);
    col = mix(vec3(0.003, 0.009, 0.024), col, exp(-d * 0.042));
    gl_FragColor = vec4(col, 1.0);
  }
`;
/** 管子后面的黑板：一格一格的细缝 */
const WALL_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const WALL_FRAG = /* glsl */ `
  uniform vec3 uCam;
  uniform float uSpacing;
  varying vec3 vWorld;
  void main() {
    float a = atan(vWorld.x, vWorld.z) * ${R.toFixed(2)};
    vec2 g = abs(fract(vec2(a, vWorld.y) / uSpacing) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    vec3 col = vec3(0.01, 0.013, 0.02) + vec3(0.028, 0.036, 0.05) * line;
    float d = length(uCam - vWorld);
    col = mix(vec3(0.003, 0.009, 0.024), col, exp(-d * 0.042));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function mountKamioka(wrapper: HTMLElement): () => void {
  const root = wrapper.querySelector<HTMLElement>('[data-km]')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-gl]')!;
  const labels = root.querySelector<HTMLElement>('[data-labels]')!;
  const counter = root.querySelector<HTMLElement>('[data-counter]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-title]')!;
  const subEl = root.querySelector<HTMLElement>('[data-sub]')!;
  const sigEl = root.querySelector<HTMLElement>('[data-sig]')!;
  const nowDisplay = root.querySelector<HTMLCanvasElement>('[data-display]')!;
  const still = reduced.matches;
  const records: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  const mobile = innerWidth < 820;

  // ---------- 水罐 ----------
  const spacing = mobile ? 1.35 : 0.92;
  const tank = buildTank(spacing);
  const events: Event[] = records.map((r) => eventFor(r.key, r.category, tank));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(0x010409);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 80 : 64, 1, 0.1, 200);
  camera.position.set(0, -1.5, 0);
  const uniforms = { uCam: { value: camera.position }, uTime: { value: 0 } };

  const geo = new THREE.SphereGeometry(0.29, mobile ? 12 : 18, mobile ? 8 : 12);
  const glow = new Float32Array(tank.count);
  const tintArr = new Float32Array(tank.count);
  const glowAttr = new THREE.InstancedBufferAttribute(glow, 1);
  const tintAttr = new THREE.InstancedBufferAttribute(tintArr, 1);
  glowAttr.setUsage(THREE.DynamicDrawUsage);
  tintAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aGlow', glowAttr);
  geo.setAttribute('aTint', tintAttr);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const pmts = new THREE.InstancedMesh(geo, mat, tank.count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const flat = new THREE.Vector3(1, 1, 0.62);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < tank.count; i++) {
    // 玻璃泡是扁的：沿法线压扁一点
    n.set(tank.normal[i * 3], tank.normal[i * 3 + 1], tank.normal[i * 3 + 2]);
    q.setFromUnitVectors(zAxis, n);
    p.set(tank.pos[i * 3], tank.pos[i * 3 + 1], tank.pos[i * 3 + 2]);
    m.compose(p, q, flat);
    pmts.setMatrixAt(i, m);
  }
  scene.add(pmts);
  const wallMat = new THREE.ShaderMaterial({
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    uniforms: { uCam: uniforms.uCam, uSpacing: { value: spacing } },
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.15, R + 0.15, HALF_H * 2 + 0.3, 128, 1, false), wallMat));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0.7, 0.4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  // ---------- 镜头：像在水里慢慢漂；转过去看着新的环；拖动可以自己看 ----------
  let yaw = 0;
  let pitch = 0;
  let yawV = 0;
  let pitchV = 0;
  let yawTo = 0;
  let pitchTo = 0;
  let manualUntil = 0;
  const lookAt = (pt: [number, number, number]) => {
    const dx = pt[0] - camera.position.x;
    const dy = pt[1] - camera.position.y;
    const dz = pt[2] - camera.position.z;
    let target = Math.atan2(dx, dz);
    while (target - yaw > Math.PI) target -= Math.PI * 2;
    while (target - yaw < -Math.PI) target += Math.PI * 2;
    yawTo = target;
    pitchTo = Math.max(-0.45, Math.min(0.45, Math.atan2(dy, Math.hypot(dx, dz)) * 0.85));
  };
  let drag: { x: number; y: number; yaw: number; pitch: number } | undefined;
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    stage.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    yawTo = drag.yaw - (e.clientX - drag.x) * 0.004;
    pitchTo = Math.max(-0.7, Math.min(0.7, drag.pitch + (e.clientY - drag.y) * 0.003));
    manualUntil = performance.now() + 8000;
  };
  const onUp = () => (drag = undefined);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  // ---------- 事件 ----------
  interface Live {
    k: number;
    t0: number;
    label: HTMLElement;
  }
  const live: Live[] = [];
  let shown = 0;
  const order = records.map((_, i) => i).sort((a, b) => hash(records[a].key + 'o') - hash(records[b].key + 'o'));
  let cursor = 0;
  const fire = (k: number, now: number) => {
    const r = records[k];
    const ev = events[k];
    const label = document.createElement('a');
    label.className = 'ring-label';
    label.href = r.href;
    label.innerHTML = '<span class="t"></span><span class="s"></span>';
    label.querySelector('.t')!.textContent = r.title;
    if (r.lang) label.querySelector('.t')!.setAttribute('lang', r.lang);
    label.querySelector('.s')!.textContent = `${RING_NAME[ev.ring]}　锥角 ${ev.sig.angle.toFixed(1)}°`;
    labels.append(label);
    // 名字只留正在发生的那一个：新的来了，旧的退场
    for (const old of live) old.label.classList.add('out');
    live.push({ k, t0: now, label });
    shown++;
    counter.textContent = `事件 №${String(shown).padStart(4, '0')}`;
    titleEl.textContent = r.title;
    if (r.lang) titleEl.lang = r.lang;
    else titleEl.removeAttribute('lang');
    subEl.textContent = `${RING_NAME[ev.ring]}　${r.categoryLabel}　${dateLabel(r.date)}`;
    sigEl.textContent = sigLine(ev);
    drawDisplay(nowDisplay, ev, tank);
    if (now * 1000 > manualUntil) lookAt(ev.center);
  };
  const LIFE = 5.5;
  // 起：极快；落：慢慢地、带一点尾巴（像荧光衰减）
  const env = (t: number) => (t < 0 ? 0 : t < 0.06 ? t / 0.06 : 0.75 * Math.exp(-(t - 0.06) / 0.9) + 0.25 * Math.exp(-(t - 0.06) / 3.2));

  // 事件表：每一条都有自己的事件图；点一行，再看一次
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  for (const section of list.querySelectorAll<HTMLElement>('section[data-cat]')) {
    const ol = section.querySelector('ol')!;
    ol.replaceChildren();
    records.forEach((r, k) => {
      if (r.category !== section.dataset.cat) return;
      const li = document.createElement('li');
      li.dataset.k = String(k);
      li.innerHTML = '<canvas aria-hidden="true"></canvas><div class="row"><a></a><span class="sig"></span></div><button type="button">再看一次</button>';
      const a = li.querySelector('a')!;
      a.href = r.href;
      a.textContent = r.title;
      if (r.lang) a.lang = r.lang;
      li.querySelector('.sig')!.textContent = sigLine(events[k]);
      ol.append(li);
      requestAnimationFrame(() => drawDisplay(li.querySelector('canvas')!, events[k], tank));
    });
  }
  const onList = (e: MouseEvent) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-k]');
    if (!row || (e.target as Element).closest('a')) return;
    manualUntil = 0;
    fire(Number(row.dataset.k), performance.now() / 1000);
    stage.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
  };
  list.addEventListener('click', onList);

  // ---------- 每一帧 ----------
  let raf = 0;
  let next = 1.4;
  let introLeft = Math.min(12, records.length);
  const v3 = new THREE.Vector3();
  let last = 0;
  const tick = (ms: number) => {
    raf = requestAnimationFrame(tick);
    const now = ms / 1000;
    const dt = Math.min(now - last || 0.016, 0.05);
    last = now;
    uniforms.uTime.value = now;
    // 放事件：开头 13 秒里 12 个（1987 年神冈接住超新星中微子的那 13 秒），之后从容一些
    if (!still && now > next && records.length) {
      fire(order[cursor % order.length], now);
      cursor++;
      if (introLeft > 0) {
        introLeft--;
        next = now + 13 / 12;
      } else next = now + 3.4;
    }
    const fade = Math.pow(0.86, dt * 60);
    if (!still) for (let i = 0; i < glow.length; i++) glow[i] *= fade;
    // 暗噪声：零星的管子自己轻轻闪一下
    if (!still)
      for (let c = 0; c < (mobile ? 2 : 5); c++) {
        const i = Math.floor(Math.random() * glow.length);
        if (glow[i] < 0.2) {
          glow[i] = 0.12 + Math.random() * 0.2;
          tintArr[i] = Math.random() * 0.4;
        }
      }
    for (let j = live.length - 1; j >= 0; j--) {
      const L = live[j];
      const t = now - L.t0;
      for (const h of events[L.k].hits) {
        const g = h.w * (still ? 1 : env(t - h.delay));
        if (g > glow[h.i]) {
          glow[h.i] = g;
          tintArr[h.i] = h.tint;
        }
      }
      // 名字跟着环心，从下面浮上来
      const [x, y, z] = events[L.k].center;
      v3.set(x, y, z).project(camera);
      const a = still ? 1 : Math.max(0, Math.min(1, (t - 0.35) / 0.6, (LIFE - t) / 1.2));
      const visible = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      L.label.style.opacity = visible && !L.label.classList.contains('out') ? a.toFixed(2) : '0';
      const rise = still ? 0 : (1 - Math.min(1, Math.max(0, (t - 0.35) / 0.9))) * 14;
      L.label.style.transform = `translate(${(((v3.x + 1) / 2) * stage.clientWidth).toFixed(1)}px, ${(((1 - v3.y) / 2) * stage.clientHeight + rise).toFixed(1)}px)`;
      if (!still && t > LIFE + 2) {
        L.label.remove();
        live.splice(j, 1);
      }
    }
    glowAttr.needsUpdate = true;
    tintAttr.needsUpdate = true;
    // 镜头：弹簧一样慢慢靠过去；没事时极慢地漂，带一点起伏
    if (!still && now * 1000 > manualUntil) yawTo += dt * 0.012;
    const k = drag ? 18 : 2.2;
    const damp = drag ? 9 : 2.6;
    yawV += ((yawTo - yaw) * k - yawV * damp) * dt;
    pitchV += ((pitchTo - pitch) * k - pitchV * damp) * dt;
    yaw += yawV * dt;
    pitch += pitchV * dt;
    const sway = still ? 0 : Math.sin(now * 0.21) * 0.015;
    camera.position.y = -1.5 + (still ? 0 : Math.sin(now * 0.13) * 0.6);
    camera.lookAt(
      camera.position.x + Math.sin(yaw) * Math.cos(pitch + sway),
      camera.position.y + Math.sin(pitch + sway),
      camera.position.z + Math.cos(yaw) * Math.cos(pitch + sway),
    );
    composer.render();
  };
  if (still && records.length) fire(order[0], 0);
  raf = requestAnimationFrame(tick);
  if (new URL(location.href).searchParams.get('sample') === '1') root.querySelector('[data-sample-note]')?.removeAttribute('hidden');

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    list.removeEventListener('click', onList);
    labels.replaceChildren();
    geo.dispose();
    mat.dispose();
    wallMat.dispose();
    composer.dispose();
    renderer.dispose();
  };
}

/**
 * PROTOTYPE（首页第十四轮）：神冈的水池（Kamioka.astro）。three.js 画水罐内部：
 * - 罐壁贴满金色的光电倍增管（InstancedMesh，自己写的着色器：金色的玻璃泡、镜头方向打来的高光、被光打中时的蓝白色）
 * - 每条记录是一次事件（tank.ts）：轮到它时，那一圈管子由近到远亮起来，再慢慢暗下去；镜头转过去看着它，环心浮出名字
 * - 没有事件的时候，零星的管子也会自己闪一下（真的探测器也有这种「暗噪声」）
 * - 开场：1987 年 2 月 23 日，神冈在不到 13 秒里接住了 12 个来自超新星 1987A 的中微子——开头先连着来 12 个事件
 * - 拖动可以自己转头看；指着名字可以打开；事件表里点一行，就再看一次那个事件
 * - 减少动态效果：不自己放事件，点事件表才亮，亮了不淡
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildTank, eventFor, hash, HALF_H, R, RING_NAME, type Event } from './tank';

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

const VERT = /* glsl */ `
  attribute float aGlow;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vGlow;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vGlow = aGlow;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uCam;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vGlow;
  void main() {
    vec3 v = normalize(uCam - vWorld);
    float ndv = max(dot(vNormal, v), 0.0);
    // 金色的玻璃泡：镜头方向的灯打过来，中间一点亮的高光，边上暗下去
    vec3 gold = vec3(0.62, 0.44, 0.18);
    vec3 base = gold * (0.06 + 0.42 * pow(ndv, 2.2));
    base += vec3(1.0, 0.86, 0.6) * pow(ndv, 80.0) * 0.35;
    base += gold * pow(1.0 - ndv, 3.0) * 0.18;
    // 被切伦科夫光打中：蓝白色
    vec3 hit = mix(vec3(0.25, 0.55, 1.0), vec3(0.85, 0.95, 1.0), smoothstep(0.6, 1.0, vGlow));
    vec3 col = base + hit * vGlow * 3.6;
    // 水：越远越暗、越蓝
    float d = length(uCam - vWorld);
    float fog = exp(-d * 0.045);
    col = mix(vec3(0.004, 0.012, 0.03), col, fog);
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
  const intro = root.querySelector<HTMLElement>('[data-intro]')!;
  const still = reduced.matches;
  const records: Rec[] = JSON.parse(document.getElementById('atlas-records')?.textContent ?? '[]');
  const mobile = innerWidth < 820;

  // ---------- 水罐 ----------
  const tank = buildTank(mobile ? 1.35 : 0.92);
  const events: Event[] = records.map((r) => eventFor(r.key, r.category, tank));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(0x010409);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 82 : 68, 1, 0.1, 200);
  camera.position.set(0, -1.5, 0);

  const geo = new THREE.SphereGeometry(0.27, mobile ? 10 : 14, mobile ? 8 : 10);
  const glow = new Float32Array(tank.count);
  const glowAttr = new THREE.InstancedBufferAttribute(glow, 1);
  glowAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aGlow', glowAttr);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uCam: { value: camera.position } } });
  const pmts = new THREE.InstancedMesh(geo, mat, tank.count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < tank.count; i++) {
    m.makeTranslation(tank.pos[i * 3], tank.pos[i * 3 + 1], tank.pos[i * 3 + 2]);
    pmts.setMatrixAt(i, m);
  }
  scene.add(pmts);
  // 管子之间是黑色的板
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.2, R + 0.2, HALF_H * 2 + 0.4, 96, 1, false),
    new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.BackSide }),
  );
  scene.add(wall);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.6, 0.42);
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

  // ---------- 镜头：看着正在发生的事件；拖动可以自己看 ----------
  let yaw = 0;
  let pitch = 0;
  let yawTo = 0;
  let pitchTo = 0;
  let manualUntil = 0;
  const lookAt = (p: [number, number, number]) => {
    const dx = p[0] - camera.position.x;
    const dy = p[1] - camera.position.y;
    const dz = p[2] - camera.position.z;
    let target = Math.atan2(dx, dz);
    while (target - yaw > Math.PI) target -= Math.PI * 2;
    while (target - yaw < -Math.PI) target += Math.PI * 2;
    yawTo = target;
    pitchTo = Math.max(-0.5, Math.min(0.5, Math.atan2(dy, Math.hypot(dx, dz))));
  };
  let drag: { x: number; y: number; yaw: number; pitch: number } | undefined;
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    stage.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    yaw = yawTo = drag.yaw - (e.clientX - drag.x) * 0.004;
    pitch = pitchTo = Math.max(-0.7, Math.min(0.7, drag.pitch + (e.clientY - drag.y) * 0.003));
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
    const label = document.createElement('a');
    label.className = 'ring-label';
    label.href = r.href;
    label.innerHTML = '<span class="t"></span><span class="s"></span>';
    label.querySelector('.t')!.textContent = r.title;
    if (r.lang) label.querySelector('.t')!.setAttribute('lang', r.lang);
    label.querySelector('.s')!.textContent = RING_NAME[events[k].ring];
    labels.append(label);
    // 名字只留正在发生的那一个：新的来了，旧的先退场
    const keep = 1;
    for (const old of live.slice(0, Math.max(0, live.length - keep + 1))) old.label.remove();
    live.push({ k, t0: now, label });
    shown++;
    counter.textContent = `事件 №${String(shown).padStart(4, '0')}`;
    titleEl.textContent = r.title;
    if (r.lang) titleEl.lang = r.lang;
    else titleEl.removeAttribute('lang');
    subEl.textContent = `${RING_NAME[events[k].ring]}　${r.categoryLabel}　${dateLabel(r.date)}`;
    if (now * 1000 > manualUntil) lookAt(events[k].center);
  };
  const LIFE = 4.5;
  const env = (t: number) => (t < 0 ? 0 : t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) / 1.6));

  // 事件表：点一行，再看一次
  const onList = (e: MouseEvent) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-k]');
    if (!row || (e.target as Element).closest('a')) return;
    manualUntil = 0;
    fire(Number(row.dataset.k), performance.now() / 1000);
    stage.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
  };
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  list.addEventListener('click', onList);
  for (const section of list.querySelectorAll<HTMLElement>('section[data-cat]')) {
    const ol = section.querySelector('ol')!;
    ol.replaceChildren();
    records.forEach((r, k) => {
      if (r.category !== section.dataset.cat) return;
      const li = document.createElement('li');
      li.dataset.k = String(k);
      li.innerHTML = '<a></a><button type="button">再看一次</button>';
      const a = li.querySelector('a')!;
      a.href = r.href;
      a.textContent = r.title;
      if (r.lang) a.lang = r.lang;
      ol.append(li);
    });
  }

  // ---------- 每一帧 ----------
  let raf = 0;
  let next = 1.2;
  let introLeft = Math.min(12, records.length);
  const v3 = new THREE.Vector3();
  const tick = (ms: number) => {
    raf = requestAnimationFrame(tick);
    const now = ms / 1000;
    // 放事件：开头 13 秒里连着 12 个，之后每 2.4 秒一个
    if (!still && now > next && records.length) {
      fire(order[cursor % order.length], now);
      cursor++;
      if (introLeft > 0) {
        introLeft--;
        next = now + 13 / 12;
        if (introLeft === 0) intro.dataset.gone = '';
      } else next = now + 2.4;
    }
    // 管子的亮度：先整体暗下去，再按正在发生的事件点亮
    for (let i = 0; i < glow.length; i++) glow[i] *= still ? 1 : 0.9;
    // 暗噪声：零星的管子自己闪一下
    if (!still)
      for (let n = 0; n < (mobile ? 3 : 7); n++) {
        const i = Math.floor(Math.random() * glow.length);
        glow[i] = Math.max(glow[i], 0.15 + Math.random() * 0.25);
      }
    for (let j = live.length - 1; j >= 0; j--) {
      const L = live[j];
      const t = now - L.t0;
      for (const h of events[L.k].hits) {
        const g = h.w * (still ? 1 : env(t - h.delay));
        if (g > glow[h.i]) glow[h.i] = g;
      }
      // 名字跟着环心
      const [x, y, z] = events[L.k].center;
      v3.set(x, y, z).project(camera);
      const fade = still ? 1 : Math.max(0, Math.min(1, t / 0.3, (LIFE - t) / 0.8));
      const visible = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      L.label.style.opacity = visible ? fade.toFixed(2) : '0';
      L.label.style.transform = `translate(${((v3.x + 1) / 2) * stage.clientWidth}px, ${((1 - v3.y) / 2) * stage.clientHeight}px)`;
      if (!still && t > LIFE) {
        L.label.remove();
        live.splice(j, 1);
      }
    }
    glowAttr.needsUpdate = true;
    // 镜头慢慢转向事件；没有事件时也极慢地自己转
    if (now * 1000 > manualUntil) yawTo += 0.0006;
    yaw += (yawTo - yaw) * 0.035;
    pitch += (pitchTo - pitch) * 0.035;
    camera.lookAt(camera.position.x + Math.sin(yaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), camera.position.z + Math.cos(yaw) * Math.cos(pitch));
    composer.render();
  };
  if (still) {
    // 减少动态：只亮一个事件，不动
    if (records.length) fire(order[0], 0);
    intro.dataset.gone = '';
  }
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
    composer.dispose();
    renderer.dispose();
  };
}

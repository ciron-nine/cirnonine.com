/**
 * PROTOTYPE（首页第十二轮）：板子的声音。拉弓是一个持续的音：几个泛音叠在一起，起音慢，带一点颤；
 * 弓停下来，音按板子的衰减慢慢散掉。点一粒作品的沙，是一声短促的「叮」。
 * 只在访客自己拉弓、点击之后才出声（浏览器的自动播放规则），外壳的「静音」按下时一律不出声。
 */
let ctx: AudioContext | undefined;
let voice: { oscs: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | undefined;

const muted = () => document.querySelector('button.mute')?.getAttribute('aria-pressed') === 'true';

function audio(): AudioContext | undefined {
  if (muted()) return undefined;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 弓压在板上：频率 f，力度 level（0..1）。频率变了就滑过去 */
export function bow(f: number, level: number) {
  const ac = audio();
  if (!ac) return release();
  const t = ac.currentTime;
  if (!voice) {
    const gain = ac.createGain();
    gain.gain.value = 0;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.7;
    filter.connect(gain).connect(ac.destination);
    // 板子的泛音不是整数倍：取几个略微错开的比
    const oscs = [1, 2.03, 2.98, 4.11].map((ratio, i) => {
      const o = ac.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f * ratio;
      const g = ac.createGain();
      g.gain.value = [0.6, 0.22, 0.12, 0.06][i];
      o.connect(g).connect(filter);
      const lfo = ac.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ac.createGain();
      depth.gain.value = f * ratio * 0.004;
      lfo.connect(depth).connect(o.frequency);
      lfo.start();
      o.start();
      return o;
    });
    voice = { oscs, gain, filter };
  }
  [1, 2.03, 2.98, 4.11].forEach((ratio, i) => voice!.oscs[i].frequency.setTargetAtTime(f * ratio, t, 0.08));
  voice.gain.gain.setTargetAtTime(0.06 * Math.min(level, 1), t, 0.12);
}

/** 弓离开：音慢慢散掉 */
export function release() {
  if (!voice || !ctx) return;
  const v = voice;
  voice = undefined;
  const t = ctx.currentTime;
  v.gain.gain.setTargetAtTime(0, t, 0.6);
  for (const o of v.oscs) o.stop(t + 4);
}

/** 叮：短促的一声 */
export function ping(f: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  g.connect(ac.destination);
  for (const [ratio, amp] of [
    [1, 1],
    [2.76, 0.4],
    [5.4, 0.15],
  ]) {
    const o = ac.createOscillator();
    o.frequency.value = f * ratio;
    const a = ac.createGain();
    a.gain.value = amp;
    o.connect(a).connect(g);
    o.start(t);
    o.stop(t + 1.7);
  }
}

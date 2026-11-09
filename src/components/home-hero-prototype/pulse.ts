/**
 * PROTOTYPE：让背景跟着背景音乐呼吸。用 Web Audio 的分析器读播放器里正在放的 audio，取低频的强弱。
 *
 * 只在读得到音频数据时才接上，否则一直返回 0，背景照常动：
 * - 同源的音频（占位音乐）直接能读
 * - R2 上的音频要两件事都做了才能读：R2 给 media.cirnonine.com 配 CORS，
 *   播放器的 audio 带 crossorigin="anonymous"（src/lib/background-music.ts 的 AUDIO_CORS）。
 *   现在 R2 没有配 CORS，所以首页（全站背景音乐在 R2 上）读不到
 *
 * 不能对跨域、没有 CORS 的 audio 建 MediaElementSource：浏览器会把它的输出变成静音，音乐就没了。
 * 一个 audio 一旦接进 AudioContext 就再也拆不出来，所以 AudioContext 和接好的节点在整个会话里都留着，
 * 换页离开首页后音乐照样经过它播放（只是没人再读分析器）。
 *
 * ?pulse=demo：没有音乐数据时用一个假的节拍（约 92 BPM），只用来看「跟着节奏呼吸」是什么样子。
 */

export interface Pulse {
  /** 当前的强弱 0..1 */
  level(): number;
  /** 现在在用哪种来源，报告和调试用 */
  source(): 'audio' | 'demo' | 'none';
}

let context: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
const connected = new WeakSet<HTMLAudioElement>();
let bins: Uint8Array<ArrayBuffer> | undefined;

/** 这个 audio 的数据读得到吗：同源，或者是带 crossorigin 加载成功的 */
function readable(audio: HTMLAudioElement): boolean {
  const src = audio.currentSrc || audio.src;
  if (!src) return false;
  if (new URL(src, location.href).origin === location.origin) return true;
  return audio.crossOrigin === 'anonymous' && audio.readyState >= HTMLMediaElement.HAVE_METADATA;
}

function connect(audio: HTMLAudioElement) {
  if (connected.has(audio) || !readable(audio)) return;
  context ??= new AudioContext();
  if (!analyser) {
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    analyser.connect(context.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
  }
  context.createMediaElementSource(audio).connect(analyser);
  connected.add(audio);
  // AudioContext 要在用户手势之后才能放出声音；进入页那一下点击已经算过，但保险起见再点一次也会恢复
  if (context.state === 'suspended') {
    const resume = () => context?.resume();
    resume();
    addEventListener('click', resume, { once: true, capture: true });
  }
}

/** 播放器里正在放的那个 audio */
function liveDeck(): HTMLAudioElement | undefined {
  return [...document.querySelectorAll<HTMLAudioElement>('.player audio')].find((a) => !a.paused && !a.muted);
}

export function createPulse(): Pulse {
  const demo = new URL(location.href).searchParams.get('pulse') === 'demo';
  const started = performance.now();
  return {
    level() {
      const deck = liveDeck();
      if (deck) connect(deck);
      if (analyser && bins && deck && connected.has(deck)) {
        analyser.getByteFrequencyData(bins);
        // 低频（约 40–250 Hz）的平均强度
        let sum = 0;
        const hi = Math.max(2, Math.round((250 / (context!.sampleRate / 2)) * bins.length));
        for (let i = 1; i < hi; i++) sum += bins[i];
        const level = sum / (hi - 1) / 255;
        // 背景音乐本身比较安静：拉开一点差距
        return Math.min(1, Math.max(0, (level - 0.25) * 1.8));
      }
      if (demo) {
        const beat = 60 / 92;
        const t = ((performance.now() - started) / 1000) % beat;
        return Math.exp(-t / 0.16);
      }
      return 0;
    },
    source() {
      const deck = liveDeck();
      if (deck && connected.has(deck)) return 'audio';
      return demo ? 'demo' : 'none';
    },
  };
}

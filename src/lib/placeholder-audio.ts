/**
 * 占位音频：在构建时现生成的柔和和弦循环（8kHz、8 位单声道 WAV），类别背景音乐的正式曲目上传到 R2 之前先用它。
 * 每一处用不同的和弦走向和音区，换页时能听出背景音乐换了。不进仓库，也不需要联网。
 *
 * 这是对 ADR-0003（音频都放在 R2）的临时偏离：占位音频从站点自己的地址 /placeholder-music/ 提供。
 * 正式曲目上传 R2 后，把 src/lib/background-music.ts 里的地址换掉，再删掉这个文件和 src/pages/placeholder-music/。
 * 注意 astro dev 给这些生成的文件不支持 Range 请求，浏览器没法跳到中间，续播只在构建后的站点（astro preview、线上）里有效。
 */

/** MIDI 音高 → 频率 */
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** 每个占位背景音乐的和弦走向（MIDI 音高） */
const PROGRESSIONS = {
  // 低音区，小调：Am – F – C – G
  games: [
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [48, 55, 60, 64],
    [43, 50, 55, 59],
  ],
  // 中音区，七和弦，安静：Fmaj7 – Em7 – Dm7 – Cmaj7
  'visual-novels': [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ],
  // 高音区，大调，明亮：C – G – Am – F
  anime: [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65],
  ],
} satisfies Record<string, number[][]>;

export type PlaceholderName = keyof typeof PROGRESSIONS;

export const PLACEHOLDER_NAMES = Object.keys(PROGRESSIONS) as PlaceholderName[];

/** 占位背景音乐在站点上的地址 */
export function placeholderMusic(name: PlaceholderName): string {
  return `/placeholder-music/${name}.wav`;
}

/** 生成一段占位背景音乐：每个和弦 secondsPerChord 秒，首尾接得上，适合循环 */
export function placeholderWav(name: PlaceholderName, secondsPerChord = 6): Uint8Array<ArrayBuffer> {
  return chordLoopWav(PROGRESSIONS[name].map((chord) => chord.map(hz)), secondsPerChord);
}

/** 一串和弦（频率）依次响起的 WAV，每个和弦淡入淡出，避免接缝处爆音 */
export function chordLoopWav(chords: number[][], secondsPerChord: number): Uint8Array<ArrayBuffer> {
  const rate = 8000;
  const perChord = rate * secondsPerChord;
  const n = perChord * chords.length;
  const ramp = Math.min(0.6, secondsPerChord / 4);
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + n, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, n, true);

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const chord = chords[Math.floor(i / perChord)];
    const local = (i % perChord) / rate;
    const envelope = Math.min(1, local / ramp) * Math.min(1, (secondsPerChord - local) / ramp);
    const sample = chord.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) / chord.length;
    bytes[44 + i] = Math.round(128 + 127 * 0.18 * envelope * sample);
  }
  return bytes;
}

/**
 * 测试用的音频：8 秒、8kHz、8 位单声道的柔和和弦 WAV，在测试里现生成。
 * 冒烟测试把对 R2 的音频请求换成它，这样既不用联网，也不依赖正式曲目（音频不放进仓库，ADR-0003）。
 */
export function testAudio(): Buffer {
  const rate = 8000;
  const seconds = 8;
  const n = rate * seconds;
  const chords = [
    [220, 277.18, 329.63],
    [196, 246.94, 293.66],
  ];
  const data = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const half = Math.floor(t / 4);
    const local = t - half * 4;
    const envelope = Math.min(1, local / 0.6) * Math.min(1, (4 - local) / 0.6);
    const sample = chords[half].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) / 3;
    data[i] = Math.round(128 + 127 * 0.18 * envelope * sample);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + n, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // 单声道
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(n, 40);
  return Buffer.concat([header, data]);
}

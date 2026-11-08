/**
 * 测试用的音频：8 秒的柔和和弦 WAV，在测试里现生成。
 * 冒烟测试把对 R2 的音频请求换成它，这样既不用联网，也不依赖正式曲目（音频不放进仓库，ADR-0003）。
 */
import { chordLoopWav } from '../../src/lib/placeholder-audio';

export function testAudio(): Buffer {
  const chords = [
    [220, 277.18, 329.63],
    [196, 246.94, 293.66],
  ];
  return Buffer.from(chordLoopWav(chords, 4));
}

import { describe, expect, it } from 'vitest';
import { audioFor, nextPlayback, startPlayback } from './playback';

const SITE_MUSIC = 'https://media.cirnonine.com/music/site.mp3';

describe('播放规则', () => {
  it('还没过进入页时什么都不播放', () => {
    const state = startPlayback({ siteMusic: SITE_MUSIC });
    expect(audioFor(state).src).toBeNull();
  });

  it('点了进入之后开始播放全站背景音乐，不静音', () => {
    const state = nextPlayback(startPlayback({ siteMusic: SITE_MUSIC }), { type: 'enter' });
    expect(audioFor(state)).toEqual({ src: SITE_MUSIC, muted: false });
  });

  it('静音只让声音消失，背景音乐还在原来那首上继续走；再按一次恢复声音', () => {
    const playing = nextPlayback(startPlayback({ siteMusic: SITE_MUSIC }), { type: 'enter' });
    const muted = nextPlayback(playing, { type: 'toggle-mute' });
    expect(audioFor(muted)).toEqual({ src: SITE_MUSIC, muted: true });
    expect(audioFor(nextPlayback(muted, { type: 'toggle-mute' }))).toEqual({ src: SITE_MUSIC, muted: false });
  });

  it('同一次会话里整页重新打开时，沿用会话里记下的状态：已经进入过就直接放，静音过就还是静音', () => {
    const state = startPlayback({ siteMusic: SITE_MUSIC, session: { entered: true, muted: true } });
    expect(state.entered).toBe(true);
    expect(audioFor(state)).toEqual({ src: SITE_MUSIC, muted: true });
  });
});

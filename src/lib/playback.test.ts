import { describe, expect, it } from 'vitest';
import {
  audioFor,
  gainsAt,
  nextPlayback,
  startPlayback,
  transitionBetween,
  type PageMusic,
  type PlaybackEvent,
  type PlaybackState,
} from './playback';

const SITE = 'https://media.cirnonine.com/music/site.mp3';
const GAMES = 'https://media.cirnonine.com/music/games.mp3';
const ANIME = 'https://media.cirnonine.com/music/anime.mp3';
const SONG = 'https://media.cirnonine.com/songs/senbonzakura.mp3';
const HM1 = 'https://media.cirnonine.com/music/hotline-miami.mp3';
const HM2 = 'https://media.cirnonine.com/music/hotline-miami-2.mp3';

/** 已经过了进入页、停在 page 这一页的状态 */
function enteredOn(page: PageMusic = {}): PlaybackState {
  return nextPlayback(startPlayback({ siteMusic: SITE, page }), { type: 'enter' });
}

/** 依次发生一串事件 */
function after(state: PlaybackState, ...events: PlaybackEvent[]): PlaybackState {
  return events.reduce(nextPlayback, state);
}

/** 此刻在放的那首的地址 */
function playing(state: PlaybackState): string | null {
  return audioFor(state).track?.src ?? null;
}

describe('播放规则', () => {
  it('还没过进入页时什么都不播放', () => {
    const state = startPlayback({ siteMusic: SITE, page: {} });
    expect(audioFor(state).track).toBeNull();
  });

  it('点了进入之后开始播放这一页的背景音乐，不静音', () => {
    const state = enteredOn();
    expect(audioFor(state)).toMatchObject({ track: { src: SITE }, muted: false });
  });

  it('静音只让声音消失，背景音乐还在原来那首上继续走；再按一次恢复声音', () => {
    const muted = after(enteredOn(), { type: 'toggle-mute' });
    expect(audioFor(muted)).toMatchObject({ track: { src: SITE }, muted: true });
    expect(audioFor(after(muted, { type: 'toggle-mute' }))).toMatchObject({ track: { src: SITE }, muted: false });
  });

  it('同一次会话里整页重新打开时，沿用会话里记下的状态：已经进入过就直接放，静音过就还是静音', () => {
    const state = startPlayback({ siteMusic: SITE, page: {}, session: { entered: true, muted: true, positions: {} } });
    expect(state.entered).toBe(true);
    expect(audioFor(state)).toMatchObject({ track: { src: SITE }, muted: true });
  });
});

describe('续播', () => {
  it('回到之前的页面时，那首背景音乐从停下的位置接着放；没放过的从头放', () => {
    const left = after(
      enteredOn({ category: GAMES }),
      { type: 'progress', src: GAMES, position: 42.5 },
      { type: 'navigate', page: { category: ANIME } },
    );
    expect(audioFor(left).track).toEqual({ src: ANIME, from: 0, kind: 'background' });

    const back = after(left, { type: 'progress', src: ANIME, position: 7 }, { type: 'navigate', page: { category: GAMES } });
    expect(audioFor(back).track).toEqual({ src: GAMES, from: 42.5, kind: 'background' });
    expect(audioFor(after(back, { type: 'navigate', page: { category: ANIME } })).track).toEqual({ src: ANIME, from: 7, kind: 'background' });
  });

  it('整页重新打开时，续播位置沿用会话里记下的', () => {
    const state = startPlayback({
      siteMusic: SITE,
      page: { category: GAMES },
      session: { entered: true, muted: false, positions: { [GAMES]: 12 } },
    });
    expect(audioFor(state).track).toEqual({ src: GAMES, from: 12, kind: 'background' });
  });
});

describe('点播', () => {
  it('在音乐页点播一首单曲，从头放这首', () => {
    const state = after(enteredOn('none'), { type: 'request', src: SONG });
    expect(audioFor(state).track).toEqual({ src: SONG, from: 0, kind: 'request' });
  });

  it('点播优先：换到有背景音乐的页面也继续放这首单曲，不被背景音乐打断', () => {
    const state = after(
      enteredOn('none'),
      { type: 'request', src: SONG },
      { type: 'navigate', page: { category: GAMES } },
      { type: 'navigate', page: { category: ANIME, work: HM1 } },
    );
    expect(playing(state)).toBe(SONG);
  });

  it('点播中静音也只让声音消失，单曲接着放', () => {
    const state = after(enteredOn('none'), { type: 'request', src: SONG }, { type: 'toggle-mute' });
    expect(audioFor(state)).toMatchObject({ track: { src: SONG }, muted: true });
  });
});

describe('点播结束后', () => {
  const OTHER_SONG = 'https://media.cirnonine.com/songs/gunjou.mp3';

  it('单曲放完，接上当前这一页的背景音乐，从它停下的位置续播', () => {
    const state = after(
      enteredOn({ category: GAMES }),
      { type: 'progress', src: GAMES, position: 30 },
      { type: 'navigate', page: 'none' },
      { type: 'request', src: SONG },
      { type: 'navigate', page: { category: GAMES } },
      { type: 'request-ended', src: SONG },
    );
    expect(audioFor(state).track).toEqual({ src: GAMES, from: 30, kind: 'background' });
  });

  it('点播时换了页，放完后接上的是现在这一页的背景音乐', () => {
    const state = after(
      enteredOn('none'),
      { type: 'request', src: SONG },
      { type: 'navigate', page: { category: ANIME } },
      { type: 'request-ended', src: SONG },
    );
    expect(playing(state)).toBe(ANIME);
  });

  it('在音乐页放完，音乐页没有背景音乐，就安静下来', () => {
    const state = after(enteredOn('none'), { type: 'request', src: SONG }, { type: 'request-ended', src: SONG });
    expect(audioFor(state).track).toBeNull();
  });

  it('点播了另一首后，前一首迟到的结束不会打断新点播的这首', () => {
    const state = after(
      enteredOn('none'),
      { type: 'request', src: SONG },
      { type: 'request', src: OTHER_SONG },
      { type: 'request-ended', src: SONG },
    );
    expect(playing(state)).toBe(OTHER_SONG);
  });
});

describe('背景音乐的层级', () => {
  it('页面声明了作品背景音乐就放作品的，只声明类别就放类别的，什么都没声明就放全站的', () => {
    expect(playing(enteredOn({ category: GAMES, work: HM1 }))).toBe(HM1);
    expect(playing(enteredOn({ category: GAMES }))).toBe(GAMES);
    expect(playing(enteredOn({}))).toBe(SITE);
  });

  it('换页后放新页面声明的背景音乐', () => {
    const state = after(enteredOn({ category: GAMES }), { type: 'navigate', page: { category: ANIME } });
    expect(playing(state)).toBe(ANIME);
  });

  it('音乐页没有背景音乐：换到音乐页时什么都不放，离开后又放下一页的', () => {
    const onMusicPage = after(enteredOn({ category: GAMES }), { type: 'navigate', page: 'none' });
    expect(audioFor(onMusicPage).track).toBeNull();
    expect(playing(after(onMusicPage, { type: 'navigate', page: { category: ANIME } }))).toBe(ANIME);
  });
});

describe('专属页按章节切换', () => {
  const HM_PAGE: PageMusic = { category: GAMES, work: HM1 };

  it('滚到第二章时作品背景音乐换成第二章的；滚回第一章时第一章的从停下的位置续播', () => {
    const second = after(
      enteredOn(HM_PAGE),
      { type: 'progress', src: HM1, position: 20 },
      { type: 'section', work: HM2 },
    );
    expect(audioFor(second).track).toEqual({ src: HM2, from: 0, kind: 'background' });

    const first = after(second, { type: 'progress', src: HM2, position: 5 }, { type: 'section', work: HM1 });
    expect(audioFor(first).track).toEqual({ src: HM1, from: 20, kind: 'background' });
  });

  it('点播中滚到别的章节，单曲照样放完；放完后接上现在所在章节的背景音乐', () => {
    const requesting = after(enteredOn(HM_PAGE), { type: 'request', src: SONG }, { type: 'section', work: HM2 });
    expect(playing(requesting)).toBe(SONG);
    expect(playing(after(requesting, { type: 'request-ended', src: SONG }))).toBe(HM2);
  });

  it('离开专属页再回来，先放页面声明的那一章，滚到哪一章再换', () => {
    const state = after(
      enteredOn(HM_PAGE),
      { type: 'section', work: HM2 },
      { type: 'navigate', page: { category: GAMES } },
      { type: 'navigate', page: HM_PAGE },
    );
    expect(playing(state)).toBe(HM1);
  });
});

describe('淡出淡入', () => {
  const games = { src: GAMES, from: 0, kind: 'background' } as const;
  const anime = { src: ANIME, from: 12, kind: 'background' } as const;
  const song = { src: SONG, from: 0, kind: 'request' } as const;

  it('换到背景音乐不同的页面：原来那首约 1 秒淡出，新的那首同时约 1 秒淡入', () => {
    const fade = transitionBetween(games, anime)!;
    expect(fade).toEqual({ out: GAMES, in: anime, fadeOutMs: 1000, fadeInMs: 1000 });
    expect(gainsAt(fade, 0)).toEqual({ out: 1, in: 0 });
    const halfway = gainsAt(fade, 500);
    for (const gain of [halfway.out, halfway.in]) {
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(1);
    }
    expect(gainsAt(fade, 1000)).toEqual({ out: 0, in: 1 });
    expect(gainsAt(fade, 5000)).toEqual({ out: 0, in: 1 });
  });

  it('背景音乐没变（同一首）就不淡出淡入，接着放', () => {
    expect(transitionBetween(games, { ...games, from: 30 })).toBeNull();
    expect(transitionBetween(null, null)).toBeNull();
  });

  it('换到音乐页时背景音乐淡出到安静；从安静的页面出来时淡入', () => {
    expect(transitionBetween(games, null)).toEqual({ out: GAMES, in: null, fadeOutMs: 1000, fadeInMs: 1000 });
    expect(transitionBetween(null, anime)).toEqual({ out: null, in: anime, fadeOutMs: 1000, fadeInMs: 1000 });
  });

  it('点播的单曲一按就以原本的音量开始，正在放的那首照样淡出', () => {
    const fade = transitionBetween(games, song)!;
    expect(fade).toMatchObject({ out: GAMES, in: song, fadeOutMs: 1000 });
    expect(gainsAt(fade, 0)).toEqual({ out: 1, in: 1 });
    expect(gainsAt(fade, 1000)).toEqual({ out: 0, in: 1 });
  });
});

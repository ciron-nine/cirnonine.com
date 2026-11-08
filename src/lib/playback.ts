/**
 * 播放规则：给定当前状态和一个事件，算出下一个状态；再从状态算出音频此刻该放什么。
 * 这里不碰 HTML audio，驱动 audio 元素的是 src/components/shell/player.ts 那层薄适配器。
 */

/**
 * 一页声明的背景音乐。'none' 是这一页没有背景音乐（音乐页）；
 * 否则写出这一页有的层级，最具体的那层生效：作品 → 类别 → 全站。
 */
export type PageMusic = 'none' | { category?: string; work?: string };

export interface PlaybackState {
  /** 全站背景音乐的地址 */
  siteMusic: string;
  /** 当前这一页声明的背景音乐 */
  page: PageMusic;
  /** 访客是否已经过了进入页（进入页那一下点击解锁声音） */
  entered: boolean;
  muted: boolean;
  /** 每首背景音乐停下时放到了第几秒，回来时从这里续播 */
  positions: Record<string, number>;
  /** 正在点播的单曲地址；点播优先于背景音乐 */
  request: string | null;
}

export type PlaybackEvent =
  | { type: 'enter' }
  | { type: 'toggle-mute' }
  /** 换到了另一页 */
  | { type: 'navigate'; page: PageMusic }
  /** 在专属页上滚到了一个章节，这一章有自己的作品背景音乐 */
  | { type: 'section'; work: string }
  /** 适配器报告某首背景音乐放到了第几秒 */
  | { type: 'progress'; src: string; position: number }
  /** 在音乐页点播一首单曲 */
  | { type: 'request'; src: string }
  /** 点播的单曲放完了，或访客把它停了 */
  | { type: 'request-ended'; src: string };

/** 此刻该放的一首 */
export interface Track {
  src: string;
  /** 从第几秒开始放（续播） */
  from: number;
  /** 背景音乐循环放；点播的单曲放一遍 */
  kind: 'background' | 'request';
}

/** 音频此刻应有的样子：放哪一首（null 是不放）、是否静音 */
export interface AudioOutput {
  track: Track | null;
  muted: boolean;
}

/** 跨整页重新加载、在同一次会话里要记住的那部分状态 */
export type SessionPlayback = Pick<PlaybackState, 'entered' | 'muted' | 'positions'>;

export function startPlayback(options: {
  siteMusic: string;
  page: PageMusic;
  session?: SessionPlayback;
}): PlaybackState {
  return {
    siteMusic: options.siteMusic,
    page: options.page,
    entered: false,
    muted: false,
    positions: {},
    request: null,
    ...options.session,
  };
}

export function nextPlayback(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case 'enter':
      return { ...state, entered: true };
    case 'toggle-mute':
      return { ...state, muted: !state.muted };
    case 'navigate':
      return { ...state, page: event.page };
    case 'section':
      return state.page === 'none' ? state : { ...state, page: { ...state.page, work: event.work } };
    case 'progress':
      return { ...state, positions: { ...state.positions, [event.src]: event.position } };
    case 'request':
      return { ...state, request: event.src };
    case 'request-ended':
      // 只认正在点播的那首：之前那首迟到的结束不算
      return event.src === state.request ? { ...state, request: null } : state;
  }
}

/** 这一页该放的背景音乐：最具体的那层；没有背景音乐的页面是 null */
function backgroundMusic(state: PlaybackState): string | null {
  const { page } = state;
  if (page === 'none') return null;
  return page.work ?? page.category ?? state.siteMusic;
}

function trackFor(state: PlaybackState): Track | null {
  if (!state.entered) return null;
  if (state.request !== null) return { src: state.request, from: 0, kind: 'request' };
  const src = backgroundMusic(state);
  return src === null ? null : { src, from: state.positions[src] ?? 0, kind: 'background' };
}

export function audioFor(state: PlaybackState): AudioOutput {
  return { track: trackFor(state), muted: state.muted };
}

/** 换背景音乐时淡出淡入的时长 */
export const CROSSFADE_MS = 1000;

/** 从放一首换到放另一首（或换到安静、从安静出来）时怎么过渡 */
export interface Transition {
  /** 淡出的那首；null 是之前没在放 */
  out: string | null;
  /** 淡入的那首；null 是之后安静下来 */
  in: Track | null;
  fadeOutMs: number;
  fadeInMs: number;
}

/** 两次输出之间要不要过渡；同一首（或一直安静）就不用，返回 null */
export function transitionBetween(before: Track | null, after: Track | null): Transition | null {
  if ((before?.src ?? null) === (after?.src ?? null)) return null;
  return {
    out: before?.src ?? null,
    in: after,
    fadeOutMs: CROSSFADE_MS,
    // 点播是访客按下的，一按就该听到，不淡入
    fadeInMs: after?.kind === 'request' ? 0 : CROSSFADE_MS,
  };
}

/** 过渡开始 elapsedMs 毫秒后，淡出和淡入的两首各自的音量（0 到 1，等功率曲线，中途听不出音量凹下去） */
export function gainsAt(transition: Transition, elapsedMs: number): { out: number; in: number } {
  const outDone = fadeFraction(elapsedMs, transition.fadeOutMs);
  const inDone = fadeFraction(elapsedMs, transition.fadeInMs);
  // 两头取精确值：cos(π/2) 算出来不是 0
  return {
    out: outDone === 1 ? 0 : Math.cos((outDone * Math.PI) / 2),
    in: inDone === 1 ? 1 : Math.sin((inDone * Math.PI) / 2),
  };
}

/** 一段淡入或淡出进行到几成（0 到 1）；时长为 0 时立刻完成 */
function fadeFraction(elapsedMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
}

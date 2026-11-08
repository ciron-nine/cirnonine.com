/**
 * 播放规则：给定当前状态和一个事件，算出下一个状态；再从状态算出音频此刻该放什么。
 * 这里不碰 HTML audio，驱动 audio 元素的是 src/components/shell/player.ts 那层薄适配器。
 */

export interface PlaybackState {
  /** 全站背景音乐的地址 */
  siteMusic: string;
  /** 访客是否已经过了进入页（进入页那一下点击解锁声音） */
  entered: boolean;
  muted: boolean;
}

export type PlaybackEvent = { type: 'enter' } | { type: 'toggle-mute' };

/** 音频此刻应有的样子：放哪个地址（null 是不放）、是否静音 */
export interface AudioOutput {
  src: string | null;
  muted: boolean;
}

/** 跨整页重新加载、在同一次会话里要记住的那部分状态 */
export type SessionPlayback = Pick<PlaybackState, 'entered' | 'muted'>;

export function startPlayback(options: { siteMusic: string; session?: SessionPlayback }): PlaybackState {
  return { siteMusic: options.siteMusic, entered: false, muted: false, ...options.session };
}

export function nextPlayback(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case 'enter':
      return { ...state, entered: true };
    case 'toggle-mute':
      return { ...state, muted: !state.muted };
  }
}

export function audioFor(state: PlaybackState): AudioOutput {
  return { src: state.entered ? state.siteMusic : null, muted: state.muted };
}

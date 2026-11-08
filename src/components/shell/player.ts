/**
 * 播放规则（src/lib/playback.ts）和 HTML audio 之间的薄适配器：
 * 把点击翻译成事件，把规则算出的结果落到 audio 元素上，并把会话状态存进 sessionStorage。
 * 播放器所在的元素带 transition:persist，ClientRouter 换页时它连同 audio 一起留下，所以只挂载一次。
 */
import { audioFor, nextPlayback, startPlayback, type PlaybackEvent, type SessionPlayback } from '../../lib/playback';
import { SESSION_KEY } from './session-key';

function readSession(): SessionPlayback | undefined {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'entered' in saved && 'muted' in saved) {
      const { entered, muted } = saved;
      if (typeof entered === 'boolean' && typeof muted === 'boolean') return { entered, muted };
    }
  } catch {
    // 存储不可用或内容损坏：当作新会话
  }
  return undefined;
}

function saveSession(session: SessionPlayback): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 存储不可用：这次会话里换页仍然正常，只是整页刷新后会再见到进入页
  }
}

export function mountPlayer(root: HTMLElement): void {
  const audio = root.querySelector('audio')!;
  const muteButton = root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
  const entry = root.querySelector('dialog')!;
  const enterButton = entry.querySelector('button')!;
  let state = startPlayback({ siteMusic: root.dataset.siteMusic!, session: readSession() });
  let waitingForGesture = false;

  /**
   * 浏览器拦下了自动播放（比如同一会话里整页刷新后没有点击）：等访客下一次点击或按键再放。
   * 用 click 而不用 pointerdown：触屏上的 pointerdown 不算解锁声音的用户手势。
   */
  function playWhenAllowed() {
    if (waitingForGesture) return;
    waitingForGesture = true;
    const retry = () => {
      waitingForGesture = false;
      removeEventListener('click', retry, true);
      removeEventListener('keydown', retry, true);
      render();
    };
    addEventListener('click', retry, true);
    addEventListener('keydown', retry, true);
  }

  function render() {
    const { src, muted } = audioFor(state);
    audio.muted = muted;
    muteButton.setAttribute('aria-pressed', String(muted));
    if (src === null) {
      audio.pause();
      return;
    }
    if (audio.getAttribute('src') !== src) audio.src = src;
    if (audio.paused) audio.play().catch(playWhenAllowed);
  }

  function dispatch(event: PlaybackEvent) {
    state = nextPlayback(state, event);
    saveSession({ entered: state.entered, muted: state.muted });
    render();
  }

  muteButton.addEventListener('click', () => dispatch({ type: 'toggle-mute' }));
  // 在点击「进入」的处理函数里直接开始播放：这一下就是解锁声音的用户手势（Safari 不认之后的 close 事件）
  enterButton.addEventListener('click', () => dispatch({ type: 'enter' }));
  // 按 Esc 关掉进入页也算进入；Esc 不算解锁声音的手势，音乐等访客下一次点击再开始
  entry.addEventListener('close', () => {
    if (!state.entered) dispatch({ type: 'enter' });
  });
  if (!state.entered && !entry.open) entry.showModal();
  render();
}

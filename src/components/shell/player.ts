/**
 * 播放规则（src/lib/playback.ts）和 HTML audio 之间的薄适配器：
 * 把点击、换页、滚动和播放进度翻译成事件，把规则算出的结果落到两个 audio 元素上（一个淡出、一个淡入），
 * 并把会话状态存进 sessionStorage。
 * 播放器所在的元素带 transition:persist，ClientRouter 换页时它连同 audio 一起留下，所以只挂载一次。
 *
 * 页面怎么声明背景音乐：Shell 把 music 写在 <body> 的 data-background-music / data-category-music /
 * data-work-music 上；专属页的章节元素写 data-section-music。点播按钮写 data-request（音频地址）和
 * data-request-title（歌名），歌名是日文时再写 data-request-lang="ja"。
 */
import {
  audioFor,
  gainsAt,
  nextPlayback,
  startPlayback,
  transitionBetween,
  type PageMusic,
  type PlaybackEvent,
  type SessionPlayback,
  type Track,
  type Transition,
} from '../../lib/playback';
import { SESSION_KEY } from './session-key';

function readSession(): SessionPlayback | undefined {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'entered' in saved && 'muted' in saved) {
      const { entered, muted } = saved;
      const positions = 'positions' in saved ? validPositions(saved.positions) : {};
      if (typeof entered === 'boolean' && typeof muted === 'boolean') return { entered, muted, positions };
    }
  } catch {
    // 存储不可用或内容损坏：当作新会话
  }
  return undefined;
}

/** 会话里存的续播位置，只留下格式对的 */
function validPositions(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function saveSession(session: SessionPlayback): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 存储不可用：这次会话里换页仍然正常，只是整页刷新后会再见到进入页
  }
}

/** 当前这一页在 <body> 上声明的背景音乐 */
function pageMusic(): PageMusic {
  const { backgroundMusic, categoryMusic, workMusic } = document.body.dataset;
  if (backgroundMusic === 'none') return 'none';
  return { category: categoryMusic, work: workMusic };
}

/** 淡出淡入时调音量的间隔。用定时器不用 requestAnimationFrame：标签页在后台时动画帧会停，淡出就停在半路 */
const FADE_STEP_MS = 25;

export function mountPlayer(root: HTMLElement): void {
  const decks = [...root.querySelectorAll('audio')];
  const muteButton = root.querySelector<HTMLButtonElement>('button.mute')!;
  const nowPlaying = root.querySelector<HTMLElement>('.now-playing')!;
  const nowPlayingTitle = nowPlaying.querySelector('.now-playing-title')!;
  const stopButton = nowPlaying.querySelector<HTMLButtonElement>('button.stop')!;
  const entry = root.querySelector('dialog')!;
  const enterButton = entry.querySelector('button')!;

  let state = startPlayback({ siteMusic: root.dataset.siteMusic!, page: pageMusic(), session: readSession() });
  /** 上一次落到 audio 上的那一首 */
  let shown: Track | null = null;
  /** 正在放 shown 的那个 audio */
  let live: HTMLAudioElement | null = null;
  /** 正在淡入或淡出的 audio 和它的定时器 */
  const fades = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();
  /** 点播过的单曲的原名和它的语言，显示在「点播中」 */
  const titles = new Map<string, { title: string; lang?: string }>();
  let waitingForGesture = false;
  let sections: IntersectionObserver | undefined;

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

  function play(audio: HTMLAudioElement) {
    audio.play().catch((error: unknown) => {
      // 只有被拦下自动播放才等访客的手势；被换曲打断（AbortError）之类的不用管
      if (error instanceof DOMException && error.name === 'NotAllowedError') playWhenAllowed();
    });
  }

  /** 让 audio 的音量在 durationMs 毫秒里按 gain(已过毫秒) 变化，结束时调用 done。同一个 audio 上新的淡变取代旧的 */
  function fade(audio: HTMLAudioElement, gain: (elapsedMs: number) => number, durationMs: number, done?: () => void) {
    clearInterval(fades.get(audio));
    fades.delete(audio);
    const started = performance.now();
    const step = () => {
      const elapsed = performance.now() - started;
      audio.volume = gain(elapsed);
      if (elapsed < durationMs) return false;
      clearInterval(fades.get(audio));
      fades.delete(audio);
      done?.();
      return true;
    };
    if (!step()) fades.set(audio, setInterval(step, FADE_STEP_MS));
  }

  /** 一个空闲的 audio（没在放、也没在淡出）；都在用时再加一个，免得正在淡出的那首被掐断 */
  function idleDeck(): HTMLAudioElement {
    const idle = decks.find((audio) => audio !== live && audio.paused && !fades.has(audio));
    if (idle) return idle;
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.muted = state.muted;
    root.prepend(audio);
    decks.push(audio);
    listen(audio);
    return audio;
  }

  /** 把 track 装进 audio，从 track.from 秒开始放 */
  function load(audio: HTMLAudioElement, track: Track) {
    audio.pause();
    audio.loop = track.kind === 'background';
    if (audio.getAttribute('src') !== track.src) audio.src = track.src;
    const seek = () => {
      if (audio.getAttribute('src') === track.src) audio.currentTime = track.from;
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
    play(audio);
  }

  function crossfade(transition: Transition) {
    const outgoing = live;
    if (outgoing) {
      // 从它此刻的音量往下淡（它可能还没淡入完）
      const from = outgoing.volume;
      fade(outgoing, (elapsed) => from * gainsAt(transition, elapsed).out, transition.fadeOutMs, () => outgoing.pause());
    }
    live = null;
    if (transition.in) {
      const incoming = idleDeck();
      fade(incoming, (elapsed) => gainsAt(transition, elapsed).in, transition.fadeInMs);
      load(incoming, transition.in);
      live = incoming;
    }
  }

  function render() {
    const { track, muted } = audioFor(state);
    for (const audio of decks) audio.muted = muted;
    muteButton.setAttribute('aria-pressed', String(muted));

    const transition = transitionBetween(shown, track);
    shown = track;
    if (transition) crossfade(transition);
    else if (live?.paused) play(live);

    renderRequest();
  }

  /** 点播按钮和「点播中」跟上当前点播的那首 */
  function renderRequest() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-request]')) {
      button.setAttribute('aria-pressed', String(button.dataset.request === state.request));
    }
    nowPlaying.hidden = state.request === null;
    const playing = state.request === null ? undefined : titles.get(state.request);
    nowPlayingTitle.textContent = playing?.title ?? '';
    if (playing?.lang) nowPlayingTitle.setAttribute('lang', playing.lang);
    else nowPlayingTitle.removeAttribute('lang');
  }

  function remember() {
    saveSession({ entered: state.entered, muted: state.muted, positions: state.positions });
  }

  function dispatch(event: PlaybackEvent) {
    state = nextPlayback(state, event);
    remember();
    render();
  }

  function listen(audio: HTMLAudioElement) {
    // 背景音乐放到哪儿了：只记正在放的那首，淡出中的和点播的单曲不记
    audio.addEventListener('timeupdate', () => {
      if (audio !== live || shown?.kind !== 'background' || audio.paused || audio.seeking) return;
      state = nextPlayback(state, { type: 'progress', src: shown.src, position: audio.currentTime });
    });
    // 点播的单曲放完了，或者音频加载失败放不了：都让背景音乐接上
    const requestOver = () => {
      if (audio === live && shown?.kind === 'request') dispatch({ type: 'request-ended', src: shown.src });
    };
    audio.addEventListener('ended', requestOver);
    audio.addEventListener('error', requestOver);
  }
  decks.forEach(listen);
  // 整页刷新或关掉之前把最新的续播位置存下来（progress 太频繁，不每次都存）
  addEventListener('pagehide', remember);

  /** 专属页：章节滚到视口中间时换成那一章的作品背景音乐 */
  function watchSections() {
    sections?.disconnect();
    const chapters = document.querySelectorAll<HTMLElement>('[data-section-music]');
    if (chapters.length === 0) return;
    sections = new IntersectionObserver(
      (entries) => {
        for (const { isIntersecting, target } of entries) {
          const work = (target as HTMLElement).dataset.sectionMusic;
          if (isIntersecting && work) dispatch({ type: 'section', work });
        }
      },
      { rootMargin: '-40% 0px -59% 0px' },
    );
    chapters.forEach((chapter) => sections!.observe(chapter));
  }

  function onPageLoad() {
    dispatch({ type: 'navigate', page: pageMusic() });
    watchSections();
  }

  // 点播按钮在页面里，换页后会换成新的元素，所以在 document 上统一接
  document.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-request]');
    const src = button?.dataset.request;
    if (!button || !src) return;
    if (state.request === src) {
      dispatch({ type: 'request-ended', src });
    } else {
      titles.set(src, { title: button.dataset.requestTitle ?? '', lang: button.dataset.requestLang });
      dispatch({ type: 'request', src });
    }
  });
  stopButton.addEventListener('click', () => {
    if (state.request !== null) dispatch({ type: 'request-ended', src: state.request });
  });
  muteButton.addEventListener('click', () => dispatch({ type: 'toggle-mute' }));
  // 在点击「进入」的处理函数里直接开始播放：这一下就是解锁声音的用户手势（Safari 不认之后的 close 事件）
  enterButton.addEventListener('click', () => dispatch({ type: 'enter' }));
  // 按 Esc 关掉进入页也算进入；Esc 不算解锁声音的手势，音乐等访客下一次点击再开始
  entry.addEventListener('close', () => {
    if (!state.entered) dispatch({ type: 'enter' });
  });
  // ClientRouter 换完页（第一次打开时也会触发，重复一次无妨）
  document.addEventListener('astro:page-load', onPageLoad);
  if (!state.entered && !entry.open) entry.showModal();
  onPageLoad();
}

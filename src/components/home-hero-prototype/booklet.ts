/**
 * PROTOTYPE（第四轮）：小册子的翻书和小交互。
 *
 * - 往下滚就是翻书：舞台钉在视口上，按滚动进度一页一页翻（Booklet.astro 里是页面，这里把它们装进一张张纸）
 *   桌面上两页一摊：第一张纸正面是封面、背面是收录；第二张纸正面是写在里面、背面是摘录；最底下是最近完成
 *   手机上顶端装订：每张纸只有正面，往上翻走
 * - 翻到哪一页，那一页加 .shown：「写在里面」开始一个字一个字写，摘录浮出来
 * - 滚动进度交给星空（book-progress.ts）
 * - 键盘焦点落到还没翻到的页上时，直接滚到那一页
 * - [data-random-one]：随机留一句语录；[data-avatar-history]：头像往回翻
 * 减少动态效果时不翻书：小册子直接摊开，星空停在第一屏。
 */
import { setBookProgress } from './book-progress';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const wide = matchMedia('(min-width: 48rem)');

/** 每张纸翻过去用的滚动距离（以屏高计）；翻完一页后多停一会儿 */
const SCREENS_PER_TURN = 1.1;
const HOLD_AT_END = 0.7;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function pickRandomQuote(root: HTMLElement) {
  for (const box of root.querySelectorAll<HTMLElement>('[data-random-one]')) {
    const items = [...box.querySelectorAll<HTMLElement>('[data-random-item]')];
    const keep = Math.floor(Math.random() * items.length);
    items.forEach((item, i) => (item.hidden = i !== keep));
  }
}

function setUpAvatars(root: HTMLElement) {
  for (const history of root.querySelectorAll<HTMLElement>('[data-avatar-history]')) {
    const slides = [...history.querySelectorAll<HTMLElement>('[data-avatar-slide]')];
    const buttons = [...history.querySelectorAll<HTMLButtonElement>('[data-avatar-step]')];
    let index = 0;
    let turning = false;
    const render = () => {
      for (const button of buttons) {
        const next = index + Number(button.dataset.avatarStep);
        button.disabled = next < 0 || next >= slides.length;
      }
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.avatarStep);
        const next = Math.min(slides.length - 1, Math.max(0, index + step));
        if (next === index || turning) return;
        const old = slides[index];
        index = next;
        render();
        slides[next].hidden = false;
        if (reduced.matches) {
          old.hidden = true;
          return;
        }
        turning = true;
        old.classList.add('turning');
        old.classList.toggle('back', step < 0);
        old.addEventListener(
          'animationend',
          () => {
            old.classList.remove('turning', 'back');
            old.hidden = true;
            turning = false;
          },
          { once: true },
        );
      });
    }
    render();
  }
}

interface Flipbook {
  destroy(): void;
}

/** 把页面装进一张张纸，按滚动翻页 */
function flip(root: HTMLElement): Flipbook {
  const book = root.querySelector<HTMLElement>('[data-book]')!;
  const holder = root.querySelector<HTMLElement>('[data-pages]')!;
  const pages = [...holder.querySelectorAll<HTMLElement>(':scope > [data-page]')];
  const single = !wide.matches;
  root.dataset.flip = '';
  root.dataset.mode = single ? 'single' : 'spread';

  // 每张纸的正面、背面；最后一页垫在最底下
  const sheets: [HTMLElement, HTMLElement | undefined][] = single
    ? pages.slice(0, -1).map((p) => [p, undefined])
    : [
        [pages[0], pages[1]],
        [pages[2], pages[3]],
      ];
  /** 每一页要翻过几张纸才看得到 */
  const needs = single ? pages.map((_, i) => i) : [0, 1, 1, 2, 2];

  const leaves = sheets.map(([front, back]) => {
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    const f = document.createElement('div');
    f.className = 'leaf-face front';
    f.append(front);
    const b = document.createElement('div');
    b.className = back ? 'leaf-face back' : 'leaf-face back blank';
    if (back) b.append(back);
    leaf.append(f, b);
    return leaf;
  });
  const base = document.createElement('div');
  base.className = 'leaf-base';
  base.append(pages[pages.length - 1]);
  // DOM 按阅读顺序排（Tab 也按这个顺序走）；纸的前后由 --z 决定，不靠 DOM 顺序
  book.append(...leaves, base);
  holder.hidden = true;

  const turns = leaves.length;
  const span = turns + HOLD_AT_END;
  const sizeRun = () => {
    root.style.height = `${innerHeight * (1 + span * SCREENS_PER_TURN)}px`;
  };
  sizeRun();

  /** 滚到这个位置时翻到了第几张（可以是小数） */
  const scrolled = () => {
    const top = root.getBoundingClientRect().top + scrollY;
    const range = root.offsetHeight - innerHeight;
    return (Math.min(Math.max((scrollY - top) / Math.max(range, 1), 0), 1) * span);
  };

  let raf = 0;
  const render = () => {
    raf = 0;
    const s = scrolled();
    const t = leaves.map((_, i) => smooth(i + 0.15, i + 0.85, s));
    leaves.forEach((leaf, i) => {
      leaf.style.setProperty('--t', t[i].toFixed(4));
      leaf.style.setProperty('--shade', Math.sin(t[i] * Math.PI).toFixed(4));
      // 还没翻的纸，上面的压着下面的；翻过去的纸，后翻的压着先翻的
      const order = t[i] > 0.5 ? 1 + i : 1 + turns - i;
      leaf.style.zIndex = String(10 + order);
      leaf.style.setProperty('--z', `${order * 0.8}px`);
    });
    // 合着的时候书小一点、斜一点，偏在一边；翻开以后摆正、居中
    const open = t[0];
    // 合着时封面偏在右边，让开左下角的行星
    const shift = single ? 0 : (1 - open) * 0.08 * book.offsetWidth;
    book.style.setProperty('--shift', `${shift.toFixed(1)}px`);
    book.style.setProperty('--tilt', `${(18 - open * 13).toFixed(2)}deg`);
    book.style.setProperty('--turn', `${((1 - open) * -4).toFixed(2)}deg`);
    book.style.setProperty('--scale', (0.8 + open * 0.2).toFixed(3));
    root.toggleAttribute('data-open', open > 0.02);
    const done = t.filter((x) => x > 0.6).length;
    pages.forEach((page, i) => page.classList.toggle('shown', needs[i] <= done));
    const total = t.reduce((a, b) => a + b, 0);
    setBookProgress(single ? (total / turns) * 2 : total);
  };
  const schedule = () => {
    raf ||= requestAnimationFrame(render);
  };
  const onResize = () => {
    sizeRun();
    schedule();
  };

  // 键盘焦点落到还没翻到的页上时，滚到正好翻开那一页的位置
  const onFocus = (event: FocusEvent) => {
    const page = (event.target as Element).closest<HTMLElement>('[data-page]');
    if (!page) return;
    const need = needs[pages.indexOf(page)];
    const at = need === 0 ? 0 : Math.min(need - 0.05, span);
    const top = root.getBoundingClientRect().top + scrollY;
    const y = top + (at / span) * (root.offsetHeight - innerHeight);
    if (Math.abs(y - scrollY) > 4) scrollTo({ top: y, behavior: 'instant' });
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', onResize);
  root.addEventListener('focusin', onFocus);
  render();

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', onResize);
      root.removeEventListener('focusin', onFocus);
      // 页面放回原处，纸拆掉
      for (const page of pages) {
        page.classList.remove('shown');
        holder.append(page);
      }
      holder.hidden = false;
      book.querySelectorAll(':scope > .leaf, :scope > .leaf-base').forEach((el) => el.remove());
      delete root.dataset.flip;
      delete root.dataset.mode;
      root.removeAttribute('data-open');
      root.style.height = '';
      setBookProgress(0);
    },
  };
}

let flipbook: Flipbook | undefined;

function arrange(root: HTMLElement) {
  flipbook?.destroy();
  flipbook = reduced.matches ? undefined : flip(root);
}

function init() {
  const root = document.querySelector<HTMLElement>('[data-booklet]');
  // 每个页面只初始化一次：模块执行时和 astro:page-load 都会叫到这里（谁先谁后不一定）
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '';
  pickRandomQuote(root);
  setUpAvatars(root);
  arrange(root);
}

const rearrange = () => {
  const root = document.querySelector<HTMLElement>('[data-booklet]');
  if (root?.dataset.ready) arrange(root);
};
reduced.addEventListener('change', rearrange);
wide.addEventListener('change', rearrange);

init();
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => {
  flipbook?.destroy();
  flipbook = undefined;
});

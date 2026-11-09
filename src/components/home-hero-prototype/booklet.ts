/**
 * PROTOTYPE（第三轮）：小册子里的小交互和动画开关。
 *
 * - [data-random-one]：随机留一句语录（每次来可能不同）
 * - [data-avatar-history]：头像一次一张，← 往回翻（更早），→ 往后翻；翻的时候旧的一页像纸一样翻过去
 * - 每一摊滚进视口时加 .open：从折缝展开、铅笔写字、语录浮现（CSS 在 Booklet.astro）
 *   只有 JS 跑起来、没开减少动态效果时才给小册子加 data-unfold；否则小册子一开始就是展开好的
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

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
        const shown = slides[next];
        index = next;
        render();
        shown.hidden = false;
        if (reduced.matches) {
          old.hidden = true;
          return;
        }
        // 新的一页先放在下面，旧的一页翻过去以后再藏起来
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

function setUpUnfold(root: HTMLElement): () => void {
  const spreads = [...root.querySelectorAll<HTMLElement>('.spread')];
  if (reduced.matches) {
    delete root.dataset.unfold;
    for (const spread of spreads) spread.classList.add('open');
    return () => {};
  }
  root.dataset.unfold = '';
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('open');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.3 },
  );
  for (const spread of spreads) io.observe(spread);
  return () => io.disconnect();
}

let cleanup = () => {};

function init() {
  const root = document.querySelector<HTMLElement>('[data-booklet]');
  // 每个页面只初始化一次：模块执行时和 astro:page-load 都会叫到这里（谁先谁后不一定）
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '';
  cleanup();
  pickRandomQuote(root);
  setUpAvatars(root);
  cleanup = setUpUnfold(root);
}

// 模块可能在 astro:page-load 之后才执行（开发服务器还在转译、或者脚本加载慢），所以执行时先试一次
init();
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => {
  cleanup();
  cleanup = () => {};
});

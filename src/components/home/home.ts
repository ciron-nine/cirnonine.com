/**
 * 首页星表里的两个小交互：
 * - [data-random-one]：随机留一句语录（每次来可能不同；没有 JS 时显示第一句）
 * - [data-avatar-history]：头像一次一张，← 往回翻（更早），→ 往后翻
 */
function pickRandomQuote(root: ParentNode) {
  for (const box of root.querySelectorAll<HTMLElement>('[data-random-one]')) {
    const items = [...box.querySelectorAll<HTMLElement>('[data-random-item]')];
    const keep = Math.floor(Math.random() * items.length);
    items.forEach((item, i) => (item.hidden = i !== keep));
  }
}

function setUpAvatars(root: ParentNode) {
  for (const history of root.querySelectorAll<HTMLElement>('[data-avatar-history]')) {
    const slides = [...history.querySelectorAll<HTMLElement>('[data-avatar-slide]')];
    const buttons = [...history.querySelectorAll<HTMLButtonElement>('[data-avatar-step]')];
    let index = 0;
    const render = () => {
      slides.forEach((slide, i) => (slide.hidden = i !== index));
      for (const button of buttons) {
        const next = index + Number(button.dataset.avatarStep);
        button.disabled = next < 0 || next >= slides.length;
      }
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        index = Math.min(slides.length - 1, Math.max(0, index + Number(button.dataset.avatarStep)));
        render();
      });
    }
    render();
  }
}

document.addEventListener('astro:page-load', () => {
  const home = document.querySelector('[data-home]');
  if (!home) return;
  pickRandomQuote(home);
  setUpAvatars(home);
});

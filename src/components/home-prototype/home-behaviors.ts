/**
 * PROTOTYPE：首页变体里的两个小交互，靠 data 属性挂上去，三个变体各自决定标记长什么样。
 *
 * - [data-random-one]：里面的 [data-random-item] 随机留一个。
 * - [data-avatar-history]：里面的 [data-avatar-slide] 一次显示一个，第一个是现在的头像；
 *   [data-avatar-step="1"] 往回翻（更早），[data-avatar-step="-1"] 往后翻（更近）；
 *   [data-avatar-position] 显示「第几个 / 共几个」，[data-avatar-caption] 显示当前头像的说明。
 */

export function pickRandomQuotes() {
  for (const box of document.querySelectorAll<HTMLElement>('[data-random-one]')) {
    const items = [...box.querySelectorAll<HTMLElement>('[data-random-item]')];
    const keep = Math.floor(Math.random() * items.length);
    items.forEach((item, i) => (item.hidden = i !== keep));
  }
}

export function setUpAvatarHistories() {
  for (const history of document.querySelectorAll<HTMLElement>('[data-avatar-history]')) {
    const slides = [...history.querySelectorAll<HTMLElement>('[data-avatar-slide]')];
    const buttons = [...history.querySelectorAll<HTMLButtonElement>('[data-avatar-step]')];
    const position = history.querySelector<HTMLElement>('[data-avatar-position]');
    let index = 0;

    const render = () => {
      slides.forEach((slide, i) => (slide.hidden = i !== index));
      for (const button of buttons) {
        const next = index + Number(button.dataset.avatarStep);
        button.disabled = next < 0 || next >= slides.length;
      }
      if (position) position.textContent = `${index + 1} / ${slides.length}`;
      history.dataset.avatarIndex = String(index);
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

import { expect, test, type Page } from '@playwright/test';
import { testAudio } from './test-audio';

test.beforeEach(async ({ page }) => {
  await page.route('https://media.cirnonine.com/**', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: testAudio() }),
  );
});

/** 此刻在放的背景音乐（播放器里在放的那个 audio）的样子 */
function backgroundMusic(page: Page) {
  return page.evaluate(() => {
    const audio = [...document.querySelectorAll('audio')].find((deck) => !deck.paused);
    return {
      playing: audio !== undefined,
      src: audio?.getAttribute('src'),
      time: audio?.currentTime ?? 0,
      muted: audio?.muted,
      /** 进入时给 audio 打上的记号还在，说明换页后还是同一个元素 */
      sameElement: audio !== undefined && (window as { enteredAudio?: HTMLAudioElement }).enteredAudio === audio,
    };
  });
}

/** 点导航里的某个类别，等页面换好 */
async function goTo(page: Page, category: string) {
  await page.getByRole('navigation').getByRole('link', { name: category }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(category);
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('过进入页后背景音乐开始播放，换页不中断；换到背景音乐不同的页面时淡出淡入，回来时续播', async ({ page }) => {
  await page.goto('/games/');
  const entry = page.getByRole('dialog');
  await expect(entry).toBeVisible();
  await entry.getByRole('button', { name: '进入' }).click();
  await expect(entry).toBeHidden();

  await expect.poll(async () => (await backgroundMusic(page)).time).toBeGreaterThan(0.5);
  await page.evaluate(() => {
    (window as { enteredAudio?: HTMLAudioElement }).enteredAudio = [...document.querySelectorAll('audio')].find(
      (deck) => !deck.paused,
    );
  });
  const before = await backgroundMusic(page);
  expect(before).toMatchObject({ playing: true, src: '/placeholder-music/games.wav' });

  // 经 ClientRouter 再打开一次游戏页：背景音乐相同，同一个音频接着放
  await goTo(page, '游戏');
  const after = await backgroundMusic(page);
  expect(after.sameElement).toBe(true);
  expect(after.playing).toBe(true);
  expect(after.time).toBeGreaterThanOrEqual(before.time);

  // 动画页的类别背景音乐不同：淡入动画的，游戏的淡出后停下
  await expect.poll(async () => (await backgroundMusic(page)).time).toBeGreaterThan(3);
  const left = (await backgroundMusic(page)).time;
  await goTo(page, '动画');
  await expect.poll(async () => (await backgroundMusic(page)).src).toBe('/placeholder-music/anime.wav');

  // 回到游戏页：游戏的背景音乐从停下的位置续播，不从头开始
  await goTo(page, '游戏');
  await expect.poll(async () => (await backgroundMusic(page)).src).toBe('/placeholder-music/games.wav');
  expect((await backgroundMusic(page)).time).toBeGreaterThanOrEqual(left - 0.5);

  await page.getByRole('button', { name: '静音' }).click();
  await expect(page.getByRole('button', { name: '静音' })).toHaveAttribute('aria-pressed', 'true');
  expect(await backgroundMusic(page)).toMatchObject({ playing: true, muted: true });

  // 同一次会话里整页重新打开，不再出现进入页，静音也还在
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('游戏');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: '静音' })).toHaveAttribute('aria-pressed', 'true');
});

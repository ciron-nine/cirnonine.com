import { expect, test, type Page } from '@playwright/test';
import { testAudio } from './test-audio';

test.beforeEach(async ({ page }) => {
  await page.route('https://media.cirnonine.com/**', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: testAudio() }),
  );
});

/** 全站背景音乐的 audio 此刻的样子 */
function backgroundMusic(page: Page) {
  return page.evaluate(() => {
    const audio = document.querySelector('audio')!;
    return {
      playing: !audio.paused,
      time: audio.currentTime,
      muted: audio.muted,
      /** 进入时给 audio 打上的记号还在，说明换页后还是同一个元素 */
      sameElement: (window as { enteredAudio?: HTMLAudioElement }).enteredAudio === audio,
    };
  });
}

test('过进入页后背景音乐开始播放，站内换页时同一个音频继续放、不从头开始', async ({ page }) => {
  await page.goto('/games/');
  const entry = page.getByRole('dialog');
  await expect(entry).toBeVisible();
  await entry.getByRole('button', { name: '进入' }).click();
  await expect(entry).toBeHidden();

  await expect.poll(async () => (await backgroundMusic(page)).time).toBeGreaterThan(0.5);
  await page.evaluate(() => {
    (window as { enteredAudio?: HTMLAudioElement }).enteredAudio = document.querySelector('audio')!;
  });
  const before = await backgroundMusic(page);
  expect(before.playing).toBe(true);

  await page.getByRole('navigation').getByRole('link', { name: '动画' }).click();
  await expect(page).toHaveURL(/\/anime\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('动画');
  await expect(page.getByRole('dialog')).toBeHidden();

  const after = await backgroundMusic(page);
  expect(after.sameElement).toBe(true);
  expect(after.playing).toBe(true);
  expect(after.time).toBeGreaterThanOrEqual(before.time);

  await page.getByRole('button', { name: '静音' }).click();
  await expect(page.getByRole('button', { name: '静音' })).toHaveAttribute('aria-pressed', 'true');
  expect(await backgroundMusic(page)).toMatchObject({ playing: true, muted: true });

  // 同一次会话里整页重新打开，不再出现进入页，静音也还在
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('动画');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: '静音' })).toHaveAttribute('aria-pressed', 'true');
});

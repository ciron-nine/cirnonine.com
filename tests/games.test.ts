import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

/** 游戏页上按顺序排下来的每一项：单独的一条记录，或者一个系列叠成的一摞 */
function entries(build: BuildResult): HTMLElement[] {
  return build.page('games/').querySelectorAll('main > ol > li');
}

/** 一项里每条记录的原名（一摞里有多条） */
function recordTitles(entry: HTMLElement): string[] {
  const stack = entry.querySelector('ol');
  return stack ? stack.querySelectorAll(':scope > li h3').map((h) => h.text) : [entry.querySelector('h2')!.text];
}

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('游戏类别页', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('列出游戏记录的原名和译名', () => {
    const text = build.page('games/').querySelector('main')!.text;
    expect(text).toContain('Hotline Miami');
    expect(text).toContain('火线迈阿密');
  });

  it('按完成日期排序，新的在前，很久以前在最后，并显示日期', () => {
    const rows = entries(build).map((li) => ({ titles: recordTitles(li), text: li.text }));
    expect(rows.map((r) => r.titles)).toEqual([
      ['SANABI'],
      ['九日'],
      ['Hotline Miami 2: Wrong Number', 'Hotline Miami'],
      ['To the Moon'],
      ['GRIS'],
    ]);
    const dates = ['2024年11月2日', '2024年8月', '2024年4月', '2019年', '很久以前'];
    rows.forEach((row, i) => expect(row.text).toContain(dates[i]));
    expect(rows[2].text).toContain('2024年3月15日');
  });

  it('显示开发者', () => {
    const records = build.page('games/').querySelectorAll('main article');
    const byTitle = (title: string) => records.find((a) => a.querySelector('h2, h3')!.text === title)!;
    expect(byTitle('Hotline Miami').text).toContain('Dennaton Games');
    expect(byTitle('九日').text).toContain('赤燭遊戲');
  });

  it('同一系列的记录叠成一摞，以系列名为题，摞里新的在上面', () => {
    const stack = entries(build).find((li) => recordTitles(li).length > 1)!;
    expect(stack.querySelector('h2')!.text).toBe('Hotline Miami');
    expect(stack.text).toContain('火线迈阿密 2：空号');
  });

  it('显示短评，并标出心头好', () => {
    const items = build
      .page('games/')
      .querySelectorAll('main li')
      .filter((li) => !li.querySelector('ol'));
    const byTitle = (title: string) => items.find((li) => li.querySelector('h2, h3')!.text === title)!;
    expect(byTitle('Hotline Miami').text).toContain('霓虹和噪音');
    expect(byTitle('Hotline Miami').text).toContain('心头好');
    expect(byTitle('GRIS').text).not.toContain('心头好');
  });
});

describe('游戏详情页', () => {
  it('有长评的记录有详情页，显示原名和渲染后的长评', () => {
    const main = build.page('games/hotline-miami/').querySelector('main')!;
    expect(main.querySelector('h1')!.text).toBe('Hotline Miami');
    expect(main.text).toContain('火线迈阿密');
    expect(main.text).toContain('Dennaton Games');
    expect(main.querySelector('em')!.text).toBe('霓虹');
    expect(main.text).toContain('第二段长评。');
  });

  it('显示语录：原文、中文译文、说话人和出处，译文和出处可以没有', () => {
    const quotes = build
      .page('games/hotline-miami/')
      .querySelectorAll('main figure')
      .map((figure) => ({
        original: figure.querySelector('blockquote')!.text.trim(),
        rest: figure.text,
      }));
    expect(quotes.map((q) => q.original)).toEqual(['Do you like hurting other people?', "I don't know who you are."]);
    expect(quotes[0].rest).toContain('你喜欢伤害别人吗？');
    expect(quotes[0].rest).toContain('Richard');
    expect(quotes[0].rest).toContain('Chapter 1');
    expect(quotes[1].rest).toContain('Jacket');
  });

  it('没有长评的记录没有详情页', () => {
    expect(build.hasPage('games/hotline-miami-2/')).toBe(false);
    expect(build.hasPage('games/gris/')).toBe(false);
  });

  it('游戏页上，有详情页的记录链接过去，没有的不是链接', () => {
    const links = build
      .page('games/')
      .querySelectorAll('main a')
      .map((a) => ({ href: a.getAttribute('href'), text: a.text }));
    expect(links).toEqual([{ href: '/games/hotline-miami/', text: 'Hotline Miami' }]);
  });
});

/** 元素 style 里的 --cover-color */
function coverColor(element: HTMLElement): string | undefined {
  return /--cover-color:\s*(#[0-9a-f]{6})/i.exec(element.getAttribute('style') ?? '')?.[1];
}

/** 两个颜色每个通道最多差多少 */
function channelDistance(a: string, b: string): number {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

describe('封面', () => {
  const recordOnGamesPage = (title: string) =>
    build
      .page('games/')
      .querySelectorAll('main article')
      .find((article) => article.querySelector('h2, h3')!.text === title)!;

  it('封面经过 Astro 优化后出现在游戏页和详情页上', () => {
    for (const img of [
      recordOnGamesPage('Hotline Miami').querySelector('img')!,
      build.page('games/hotline-miami/').querySelector('main img')!,
    ]) {
      expect(img.getAttribute('src')).toMatch(/^\/_astro\/hotline-miami\.[\w-]+\.webp$/);
    }
    expect(recordOnGamesPage('GRIS').querySelector('img')).toBeNull();
  });

  it('每张封面都有构建时提取的主色，取的是占大部分的那种颜色', () => {
    // 测试封面：Hotline Miami 大部分是 #e0218a，一侧有一条 #00d0e0；SANABI 大部分是 #f08c1e，一条 #1e2a50
    const hotlineMiami = coverColor(recordOnGamesPage('Hotline Miami'));
    const sanabi = coverColor(recordOnGamesPage('SANABI'));
    expect(channelDistance(hotlineMiami!, '#e0218a')).toBeLessThanOrEqual(16);
    expect(channelDistance(sanabi!, '#f08c1e')).toBeLessThanOrEqual(16);
    expect(coverColor(build.page('games/hotline-miami/').querySelector('main')!)).toBe(hotlineMiami);
    expect(coverColor(recordOnGamesPage('GRIS'))).toBeUndefined();
  });
});

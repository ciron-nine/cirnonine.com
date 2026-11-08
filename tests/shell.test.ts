import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('外壳', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('首页、类别页、详情页都有', () => {
    expect(build.routes('')).toEqual(expect.arrayContaining(['', 'games/', 'games/hotline-miami/', 'music/']));
  });

  it('每一页都有链回首页的站标和通往四个类别的导航', () => {
    for (const route of build.routes('')) {
      const header = build.page(route).querySelector('body > header');
      expect(header, route).not.toBeNull();
      const links = header!.querySelectorAll('a').map((a) => ({ href: a.getAttribute('href'), text: a.text.trim() }));
      expect(links, route).toEqual([
        { href: '/', text: 'cirnonine' },
        { href: '/games/', text: '游戏' },
        { href: '/visual-novels/', text: '视觉小说' },
        { href: '/anime/', text: '动画' },
        { href: '/music/', text: '音乐' },
      ]);
    }
  });

  it('每一页都有静音按钮和进入页', () => {
    for (const route of build.routes('')) {
      const page = build.page(route);
      expect(page.querySelector('button[aria-pressed]')?.text.trim(), route).toBe('静音');
      expect(page.querySelector('dialog button')?.text.trim(), route).toBe('进入');
    }
  });
});

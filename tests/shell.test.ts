import { existsSync } from 'node:fs';
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

  it('每一页都能用键盘跳过导航，直接到正文', () => {
    for (const route of build.routes('')) {
      const page = build.page(route);
      const skip = page.querySelector('body > a[href="#main"]');
      expect(skip?.text.trim(), route).toBe('跳到正文');
      expect(page.querySelector('main#main'), route).not.toBeNull();
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

describe('每一页声明的背景音乐', () => {
  /** 一页在 <body> 上声明的背景音乐 */
  function declared(route: string) {
    const body = build.page(route).querySelector('body')!;
    return {
      none: body.getAttribute('data-background-music') === 'none',
      category: body.getAttribute('data-category-music') ?? null,
      work: body.getAttribute('data-work-music') ?? null,
    };
  }

  it('首页没有声明类别和作品背景音乐，放全站背景音乐', () => {
    expect(declared('')).toEqual({ none: false, category: null, work: null });
  });

  it('游戏、视觉小说、动画的类别页和详情页都声明自己类别的背景音乐（暂用占位音频）', () => {
    const expected = {
      'games/': '/placeholder-music/games.wav',
      'games/hotline-miami/': '/placeholder-music/games.wav',
      'visual-novels/': '/placeholder-music/visual-novels.wav',
      'visual-novels/atri-my-dear-moments/': '/placeholder-music/visual-novels.wav',
      'anime/': '/placeholder-music/anime.wav',
      'anime/k-on-movie/': '/placeholder-music/anime.wav',
    };
    for (const [route, category] of Object.entries(expected)) {
      expect(declared(route), route).toEqual({ none: false, category, work: null });
    }
  });

  it('音乐页没有背景音乐', () => {
    expect(declared('music/')).toEqual({ none: true, category: null, work: null });
  });

  it('占位音频随站点一起生成', () => {
    for (const name of ['games', 'visual-novels', 'anime']) {
      expect(existsSync(`${build.outDir}/placeholder-music/${name}.wav`), name).toBe(true);
    }
  });
});

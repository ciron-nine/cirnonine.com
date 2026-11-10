import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, buildSiteContent, type BuildResult } from './build';

let build: BuildResult;
let home: HTMLElement;
beforeAll(() => {
  build = buildFixture('valid');
  home = build.page('');
}, BUILD_TIMEOUT);

/** 星图上的星，按名字找 */
const stars = () => home.querySelectorAll('[data-star-chart] .star');
const star = (title: string) => stars().find((s) => s.getAttribute('data-title') === title)!;

describe('首页', () => {
  it('构建成功，是正式版：没有原型的变体和切换条', () => {
    expect(build.ok, build.output).toBe(true);
    expect(home.querySelector('[data-variant]')).toBeNull();
    expect(home.querySelector('[data-prototype-switcher]')).toBeNull();
  });

  describe('记录星图', () => {
    it('每条记录是一颗星，点进去是它的详情页，没有详情页的去所在类别页', () => {
      expect(stars().length).toBe(21);
      expect(star('Hotline Miami').getAttribute('href')).toBe('/games/hotline-miami/');
      expect(star('GRIS').getAttribute('href')).toBe('/games/');
      expect(star('千本桜').getAttribute('href')).toBe('/music/');
    });

    it('心头好是标出来的星', () => {
      const favorites = stars()
        .filter((s) => s.classList.contains('favorite'))
        .map((s) => s.getAttribute('data-title'))
        .sort();
      expect(favorites).toEqual(['ATRI -My Dear Moments-', 'Hotline Miami', 'ぼっち・ざ・ろっく！', '千本桜'].sort());
    });

    it('同一系列的记录连成星座', () => {
      const lines = home.querySelectorAll('[data-star-chart] .constellation line');
      const bySeries = (series: string) => lines.filter((l) => l.getAttribute('data-series') === series).length;
      expect(bySeries('k-on')).toBe(2);
      expect(bySeries('hotline-miami')).toBe(1);
      expect(bySeries('bishoujo-mangekyou')).toBe(1);
      expect(lines.length).toBe(4);
    });

    it('放大到最大时每颗星都有名字，日文原名标成日文', () => {
      for (const s of stars()) {
        const label = s.querySelector('text.level-4');
        expect(label?.text, s.getAttribute('data-title')!).toBe(s.getAttribute('data-title'));
      }
      expect(star('けいおん！').querySelector('text')!.getAttribute('lang')).toBe('ja');
      expect(star('九日').querySelector('text')!.getAttribute('lang')).toBeUndefined();
    });

    it('四个类别各是一个天区，点类别名可以缩放过去', () => {
      const regions = home.querySelectorAll('[data-star-chart] [data-zoom-to]').map((r) => r.text.trim());
      expect(regions).toEqual(['游戏', '视觉小说', '动画', '音乐']);
    });
  });

  describe('星表', () => {
    it('收录：四个类别的入口和件数', () => {
      const rows = home.querySelectorAll('.legend li[data-category]').map((li) => ({
        href: li.querySelector('a')!.getAttribute('href'),
        text: li.querySelector('a')!.text.trim(),
        count: li.querySelector('.count')!.text.trim(),
      }));
      expect(rows).toEqual([
        { href: '/games/', text: '游戏', count: '6' },
        { href: '/visual-novels/', text: '视觉小说', count: '5' },
        { href: '/anime/', text: '动画', count: '6' },
        { href: '/music/', text: '音乐', count: '4' },
      ]);
    });

    it('最近完成：跨类别按完成日期最近的 5 条', () => {
      const titles = home.querySelectorAll('.recent tr').map((tr) => tr.querySelector('a')!.text.trim());
      expect(titles).toEqual(['SANABI', '九日', 'ATRI -My Dear Moments-', '千本桜', 'ワールドイズマイン']);
      expect(home.querySelector('.recent tr')!.text).toContain('2024年11月2日');
    });

    it('摘录：所有语录都是候选，每句带着自己的类别，没有 JS 时只显示第一句', () => {
      const candidates = home.querySelectorAll('[data-random-one] [data-random-item]');
      expect(candidates.length).toBe(8);
      expect(new Set(candidates.map((c) => c.getAttribute('data-category')))).toEqual(
        new Set(['games', 'visual-novels', 'anime', 'songs']),
      );
      expect(candidates.filter((c) => !c.hasAttribute('hidden')).length).toBe(1);
    });

    it('头像史：现在的头像显示着，以前的可以往回翻', () => {
      const slides = home.querySelectorAll('[data-avatar-history] [data-avatar-slide]');
      expect(slides.length).toBeGreaterThan(1);
      expect(slides.filter((s) => !s.hasAttribute('hidden')).length).toBe(1);
      expect(home.querySelector('[data-avatar-history] button[data-avatar-step]')).not.toBeNull();
    });

    it('还没填地址的外部链接不出现', () => {
      expect(home.querySelectorAll('.elsewhere a')).toEqual([]);
    });
  });
});

describe('首页（站点的真实内容）', () => {
  let site: BuildResult;
  beforeAll(() => {
    site = buildSiteContent();
  }, BUILD_TIMEOUT);

  it('出自已有记录的头像链到那条记录', () => {
    const slides = site.page('').querySelectorAll('[data-avatar-history] [data-avatar-slide]');
    const linked = slides.map((s) => s.querySelector('a')?.getAttribute('href')).filter(Boolean);
    expect(linked).toEqual(expect.arrayContaining(['/visual-novels/', '/anime/']));
  });
});

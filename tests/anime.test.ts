import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

/** 动画页上按顺序排下来的每一项：单独的一条记录，或者一个系列叠成的一摞 */
function entries(build: BuildResult): HTMLElement[] {
  return build.page('anime/').querySelectorAll('main > ol > li');
}

/** 一项里每条记录的原名（一摞里有多条） */
function recordTitles(entry: HTMLElement): string[] {
  const stack = entry.querySelector('ol');
  return stack ? stack.querySelectorAll(':scope > li h3').map((h) => h.text) : [entry.querySelector('h2')!.text];
}

/** 动画页上某条记录（按原名找） */
function record(build: BuildResult, title: string): HTMLElement {
  return build
    .page('anime/')
    .querySelectorAll('main article')
    .find((article) => article.querySelector('h2, h3')!.text === title)!;
}

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('动画类别页', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('按完成日期排序，新的在前，很久以前在最后；同一系列叠成一摞', () => {
    const rows = entries(build).map((li) => ({ titles: recordTitles(li), text: li.text }));
    expect(rows.map((r) => r.titles)).toEqual([
      ['ぼっち・ざ・ろっく！'],
      ['日常'],
      ['映画けいおん！', 'けいおん！！', 'けいおん！'],
      ['らき☆すた'],
    ]);
    const dates = ['2023年1月5日', '2020年7月', '2016年1月1日', '很久以前'];
    rows.forEach((row, i) => expect(row.text).toContain(dates[i]));
    expect(entries(build)[2].querySelector('h2')!.text).toBe('けいおん！');
  });

  it('显示原名、译名、年份季度、集数和制作公司；剧场版没有季度和集数', () => {
    const bocchi = record(build, 'ぼっち・ざ・ろっく！').text;
    expect(bocchi).toContain('孤独摇滚！');
    expect(bocchi).toContain('2022年秋季');
    expect(bocchi).toContain('12 集');
    expect(bocchi).toContain('CloverWorks');

    const movie = record(build, '映画けいおん！').text;
    expect(movie).toContain('2011年');
    expect(movie).not.toMatch(/季/);
    expect(movie).not.toContain('集');
    expect(movie).toContain('京都アニメーション');
  });

  it('显示短评，并标出心头好', () => {
    expect(record(build, 'ぼっち・ざ・ろっく！').text).toContain('吉他和纸箱');
    expect(record(build, 'ぼっち・ざ・ろっく！').text).toContain('心头好');
    expect(record(build, '日常').text).not.toContain('心头好');
  });
});

describe('动画详情页', () => {
  it('有长评的记录有详情页，显示原名、制作信息和渲染后的长评', () => {
    const main = build.page('anime/k-on-movie/').querySelector('main')!;
    expect(main.querySelector('h1')!.text).toBe('映画けいおん！');
    expect(main.text).toContain('轻音少女 剧场版');
    expect(main.text).toContain('京都アニメーション');
    expect(main.querySelector('em')!.text).toBe('毕业旅行');
    expect(main.text).toContain('第二段长评。');
  });

  it('显示语录：原文、中文译文、说话人和出处，译文和出处可以没有', () => {
    const quotes = build
      .page('anime/k-on-movie/')
      .querySelectorAll('main figure')
      .map((figure) => ({ original: figure.querySelector('blockquote')!.text.trim(), rest: figure.text }));
    expect(quotes.map((q) => q.original)).toEqual(['天使にふれたよ！', 'ロンドンだ！']);
    expect(quotes[0].rest).toContain('触碰到天使了！');
    expect(quotes[0].rest).toContain('唯');
    expect(quotes[0].rest).toContain('卒業式のあと');
    expect(quotes[1].rest).toContain('律');
  });

  it('没有长评的记录没有详情页，动画页上只有有详情页的记录是链接', () => {
    expect(build.hasPage('anime/k-on/')).toBe(false);
    expect(build.hasPage('anime/bocchi-the-rock/')).toBe(false);
    const links = build
      .page('anime/')
      .querySelectorAll('main a')
      .map((a) => ({ href: a.getAttribute('href'), text: a.text }));
    expect(links).toEqual([{ href: '/anime/k-on-movie/', text: '映画けいおん！' }]);
  });
});

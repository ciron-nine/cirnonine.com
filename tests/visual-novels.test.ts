import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

/** 视觉小说页上按顺序排下来的每一项：单独的一条记录，或者一个系列叠成的一摞 */
function entries(build: BuildResult): HTMLElement[] {
  return build.page('visual-novels/').querySelectorAll('main > ol > li');
}

/** 一项里每条记录的原名（一摞里有多条） */
function recordTitles(entry: HTMLElement): string[] {
  const stack = entry.querySelector('ol');
  return stack ? stack.querySelectorAll(':scope > li h3').map((h) => h.text) : [entry.querySelector('h2')!.text];
}

/** 视觉小说页上某条记录（按原名找） */
function record(build: BuildResult, title: string): HTMLElement {
  return build
    .page('visual-novels/')
    .querySelectorAll('main article')
    .find((article) => article.querySelector('h2, h3')!.text === title)!;
}

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('视觉小说类别页', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('按完成日期排序，新的在前，很久以前在最后；同一系列叠成一摞', () => {
    const rows = entries(build).map((li) => ({ titles: recordTitles(li), text: li.text }));
    expect(rows.map((r) => r.titles)).toEqual([
      ['ATRI -My Dear Moments-'],
      ['千恋＊万花'],
      ['美少女万華鏡 -忘れな草と永遠の少女-', '美少女万華鏡 -呪われし伝説の少女-'],
      ['海沙风云'],
    ]);
    const dates = ['2024年6月10日', '2023年8月', '2022年5月', '很久以前'];
    rows.forEach((row, i) => expect(row.text).toContain(dates[i]));
    expect(rows[2].text).toContain('2022年');
    expect(entries(build)[2].querySelector('h2')!.text).toBe('美少女万華鏡');
  });

  it('显示原名、译名、品牌、剧本作者和完成的路线', () => {
    const atri = record(build, 'ATRI -My Dear Moments-').text;
    expect(atri).toContain('亚托莉 -我挚爱的时光-');
    expect(atri).toContain('枕');
    expect(atri).toContain('紺野アスタ');
    expect(atri).toContain('アトリ');

    const senren = record(build, '千恋＊万花').text;
    expect(senren).toContain('ゆずソフト');
    for (const name of ['天宮りょう', '和泉万夜', '朝武芳乃', '常陸茉子', 'ムラサメ']) expect(senren).toContain(name);
  });

  it('显示短评，并标出心头好', () => {
    expect(record(build, 'ATRI -My Dear Moments-').text).toContain('海面下的夏天');
    expect(record(build, 'ATRI -My Dear Moments-').text).toContain('心头好');
    expect(record(build, '千恋＊万花').text).not.toContain('心头好');
  });
});

describe('视觉小说详情页', () => {
  it('有长评的记录有详情页，显示原名、品牌、路线和渲染后的长评', () => {
    const main = build.page('visual-novels/atri-my-dear-moments/').querySelector('main')!;
    expect(main.querySelector('h1')!.text).toBe('ATRI -My Dear Moments-');
    expect(main.text).toContain('亚托莉 -我挚爱的时光-');
    expect(main.text).toContain('枕');
    expect(main.text).toContain('紺野アスタ');
    expect(main.querySelector('dl')!.text).toContain('アトリ');
    expect(main.querySelector('em')!.text).toBe('小镇');
    expect(main.text).toContain('第二段长评。');
  });

  it('显示语录：原文、中文译文、说话人和出处，译文和出处可以没有', () => {
    const quotes = build
      .page('visual-novels/atri-my-dear-moments/')
      .querySelectorAll('main figure')
      .map((figure) => ({ original: figure.querySelector('blockquote')!.text.trim(), rest: figure.text }));
    expect(quotes.map((q) => q.original)).toEqual(['私は高性能ですから！', '夏生さん。']);
    expect(quotes[0].rest).toContain('因为我是高性能的嘛！');
    expect(quotes[0].rest).toContain('アトリ');
    expect(quotes[0].rest).toContain('序章');
    expect(quotes[1].rest).toContain('アトリ');
  });

  it('没有长评的记录没有详情页，视觉小说页上只有有详情页的记录是链接', () => {
    expect(build.hasPage('visual-novels/senren-banka/')).toBe(false);
    expect(build.hasPage('visual-novels/haisha-fengyun/')).toBe(false);
    const links = build
      .page('visual-novels/')
      .querySelectorAll('main a')
      .map((a) => ({ href: a.getAttribute('href'), text: a.text }));
    expect(links).toEqual([{ href: '/visual-novels/atri-my-dear-moments/', text: 'ATRI -My Dear Moments-' }]);
  });
});

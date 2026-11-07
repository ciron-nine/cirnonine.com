import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

/** 音乐页上按顺序排下来的每一首单曲 */
function songs(build: BuildResult): HTMLElement[] {
  return build.page('music/').querySelectorAll('main > ol > li > article');
}

/** 音乐页上某首单曲（按歌名找） */
function song(build: BuildResult, title: string): HTMLElement {
  return songs(build).find((article) => article.querySelector('h2')!.text === title)!;
}

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('音乐类别页', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('按收录日期排序，新的在前，很久以前在最后，并显示日期', () => {
    const rows = songs(build);
    expect(rows.map((article) => article.querySelector('h2')!.text)).toEqual([
      '千本桜',
      'ワールドイズマイン',
      'タイムパラドックス',
      '群青',
    ]);
    const dates = ['2024年5月1日', '2024年5月', '2023年', '很久以前'];
    rows.forEach((article, i) => expect(article.text).toContain(dates[i]));
  });

  it('显示歌名、译名、演唱者和 P 主（分开写）、风格标签', () => {
    const senbonzakura = song(build, '千本桜');
    expect(senbonzakura.text).toContain('千本樱');
    const credits = Object.fromEntries(
      senbonzakura.querySelectorAll('dt').map((dt) => [dt.text, dt.nextElementSibling!.text]),
    );
    expect(credits).toMatchObject({ 演唱: '初音ミク', P主: '黒うさP', 风格: 'ボカロ、和風ロック' });
  });

  it('二创标出原曲，不是二创的没有原曲', () => {
    expect(song(build, 'タイムパラドックス').text).toContain('原曲');
    expect(song(build, 'タイムパラドックス').text).toContain('秘境のマーメイド');
    expect(song(build, '群青').text).not.toContain('原曲');
  });

  it('外部链接可以点过去，有音频地址的单曲可以在页面上播放', () => {
    const senbonzakura = song(build, '千本桜');
    expect(senbonzakura.querySelectorAll('a').map((a) => [a.text, a.getAttribute('href')])).toEqual([
      ['niconico', 'https://www.nicovideo.jp/watch/sm15630734'],
      ['YouTube', 'https://www.youtube.com/watch?v=shs0rAiwsGQ'],
    ]);
    expect(senbonzakura.querySelector('audio')!.getAttribute('src')).toBe(
      'https://media.cirnonine.com/songs/senbonzakura.mp3',
    );
    expect(song(build, '群青').querySelector('audio')).toBeNull();
  });

  it('显示短评、心头好和歌词语录（原文和可选的中文译文）', () => {
    const senbonzakura = song(build, '千本桜');
    expect(senbonzakura.text).toContain('永远的开场曲');
    expect(senbonzakura.text).toContain('心头好');
    expect(song(build, '群青').text).not.toContain('心头好');

    const lyrics = senbonzakura
      .querySelectorAll('figure')
      .map((figure) => ({ original: figure.querySelector('blockquote')!.text.trim(), rest: figure.text }));
    expect(lyrics.map((l) => l.original)).toEqual(['大胆不敵にハイカラ革命', '千本桜 夜ニ紛レ']);
    expect(lyrics[0].rest).toContain('大胆无畏的摩登革命');
  });
});

describe('单曲的长评', () => {
  it('有长评的单曲在音乐页上直接展开阅读，长评经过 Markdown 渲染', () => {
    const review = song(build, '千本桜').querySelector('details')!;
    expect(review.querySelector('summary')!.text).toBe('长评');
    expect(review.querySelector('em')!.text).toBe('初中');
    expect(review.text).toContain('第二段长评。');
    expect(song(build, 'ワールドイズマイン').querySelector('details')).toBeNull();
  });

  it('单曲永远没有详情页，即使有长评', () => {
    expect(build.hasPage('music/senbonzakura/')).toBe(false);
    expect(build.hasPage('songs/senbonzakura/')).toBe(false);
    expect(build.routes('music/')).toEqual(['music/']);
    expect(build.routes('songs/')).toEqual([]);
  });
});

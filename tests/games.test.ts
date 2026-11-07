import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

describe('游戏类别页', () => {
  let build: BuildResult;
  beforeAll(() => {
    build = buildFixture('valid');
  }, BUILD_TIMEOUT);

  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('列出游戏记录的原名和译名', () => {
    const text = build.page('games/').querySelector('main')!.text;
    expect(text).toContain('Hotline Miami');
    expect(text).toContain('火线迈阿密');
  });

  it('按完成日期排序，新的在前，很久以前在最后，并显示日期', () => {
    const rows = build
      .page('games/')
      .querySelectorAll('main li')
      .map((li) => ({ title: li.querySelector('h2')!.text, text: li.text }));
    expect(rows.map((r) => r.title)).toEqual(['SANABI', '九日', 'Hotline Miami', 'To the Moon', 'GRIS']);
    const dates = ['2024年11月2日', '2024年8月', '2024年3月15日', '2019年', '很久以前'];
    rows.forEach((row, i) => expect(row.text).toContain(dates[i]));
  });

  it('显示短评，并标出心头好', () => {
    const items = build.page('games/').querySelectorAll('main li');
    const hotlineMiami = items.find((li) => li.querySelector('h2')!.text === 'Hotline Miami')!;
    const gris = items.find((li) => li.querySelector('h2')!.text === 'GRIS')!;
    expect(hotlineMiami.text).toContain('霓虹和噪音');
    expect(hotlineMiami.text).toContain('心头好');
    expect(gris.text).not.toContain('心头好');
  });
});

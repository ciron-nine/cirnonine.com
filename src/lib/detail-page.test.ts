import { describe, expect, it } from 'vitest';
import { detailPage, type BespokePages } from './detail-page';

const bespoke: BespokePages = {
  records: { 'games/to-the-moon': '/to-the-moon/' },
  series: { 'hotline-miami': '/hotline-miami/' },
};

function game(slug: string, { body = '', series }: { body?: string; series?: string } = {}) {
  return { collection: 'games', body, data: { slug, series: series ? { id: series } : undefined } };
}

describe('详情页规则', () => {
  it('记录有专属页时去专属页，即使它有长评', () => {
    expect(detailPage(game('to-the-moon', { body: '长评' }), bespoke)).toEqual({
      kind: 'bespoke',
      href: '/to-the-moon/',
    });
  });

  it('系列有专属页时，系列里的每一部去专属页里自己的章节', () => {
    expect(detailPage(game('hotline-miami-2', { series: 'hotline-miami' }), bespoke)).toEqual({
      kind: 'bespoke',
      href: '/hotline-miami/#hotline-miami-2',
    });
  });

  it('没有专属页但有长评时去类别默认详情页', () => {
    expect(detailPage(game('gris', { body: '\n长评\n' }), bespoke)).toEqual({ kind: 'default', href: '/games/gris/' });
  });

  it('既没有专属页也没有长评（或长评只有空白）时没有详情页', () => {
    expect(detailPage(game('gris'), bespoke)).toBeUndefined();
    expect(detailPage(game('gris', { body: '  \n' }), bespoke)).toBeUndefined();
    expect(detailPage(game('sanabi', { series: 'sanabi' }), bespoke)).toBeUndefined();
  });
});

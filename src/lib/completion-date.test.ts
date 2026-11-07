import { describe, expect, it } from 'vitest';
import {
  compareCompletionDates,
  completionDateTimeAttribute,
  formatCompletionDate,
  parseCompletionDate,
} from './completion-date';

describe('完成日期', () => {
  it('YAML 写成 2024-03-15 时解析为精确到日', () => {
    // YAML 把未加引号的 2024-03-15 解析成 UTC 零点的 Date
    const date = parseCompletionDate(new Date('2024-03-15T00:00:00Z'));
    expect(formatCompletionDate(date)).toBe('2024年3月15日');
  });

  it('写成 2024-03 时解析为精确到月', () => {
    expect(formatCompletionDate(parseCompletionDate('2024-03'))).toBe('2024年3月');
  });

  it('写成 2024 时解析为精确到年', () => {
    // YAML 把未加引号的 2024 解析成数字
    expect(formatCompletionDate(parseCompletionDate(2024))).toBe('2024年');
  });

  it('写成 unknown 时归入很久以前', () => {
    expect(formatCompletionDate(parseCompletionDate('unknown'))).toBe('很久以前');
  });

  it('加了引号的 "2024-03-15" 也是精确到日', () => {
    expect(formatCompletionDate(parseCompletionDate('2024-03-15'))).toBe('2024年3月15日');
  });

  it.each([
    ['不存在的月份', '2024-13'],
    ['不存在的日子', '2024-02-30'],
    ['随手写的文字', '去年夏天'],
    ['两位数年份', 24],
    ['空值', undefined],
    ['带时刻的日期时间', new Date('2024-03-14T16:00:00Z')],
  ])('%s（%s）报错并说明合法写法', (_label, raw) => {
    expect(() => parseCompletionDate(raw)).toThrow(/2024-03-15.*2024-03.*2024.*unknown/);
  });

  it('按新的在前排序，很久以前排在所有有日期的之后', () => {
    const shuffled = ['unknown', '2019', '2024-03', '2023-12-31', '2024-03-15', 'unknown', '2024-01-02'];
    const sorted = shuffled
      .map(parseCompletionDate)
      .sort(compareCompletionDates)
      .map(formatCompletionDate);
    expect(sorted).toEqual([
      '2024年3月15日',
      '2024年3月',
      '2024年1月2日',
      '2023年12月31日',
      '2019年',
      '很久以前',
      '很久以前',
    ]);
  });

  it('同一段时间里，只记得大概的排在记得具体日子的之后', () => {
    const sorted = ['2024', '2024-12', '2024-01-01', '2024-12-25']
      .map(parseCompletionDate)
      .sort(compareCompletionDates)
      .map(formatCompletionDate);
    expect(sorted).toEqual(['2024年12月25日', '2024年12月', '2024年1月1日', '2024年']);
  });

  it('给 <time datetime> 用的值保留原本的精度，很久以前没有', () => {
    expect(
      ['2024-03-05', '2024-03', '2024', 'unknown'].map((raw) =>
        completionDateTimeAttribute(parseCompletionDate(raw)),
      ),
    ).toEqual(['2024-03-05', '2024-03', '2024', undefined]);
  });
});

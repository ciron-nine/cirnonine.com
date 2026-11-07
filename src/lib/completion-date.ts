import { z } from 'astro/zod';

/**
 * 完成日期：一条记录完成的时间，精度可以到日、到月、到年，或者不记得（归入「很久以前」）。
 * 解析、显示和排序都只在这里做。
 */
export type CompletionDate =
  | { precision: 'day'; year: number; month: number; day: number }
  | { precision: 'month'; year: number; month: number }
  | { precision: 'year'; year: number }
  | { precision: 'long-ago' };

const ACCEPTED_FORMS = '2024-03-15（到日）、2024-03（到月）、2024（到年）或 unknown（不记得，归入很久以前）';

export class CompletionDateError extends Error {
  constructor(raw: unknown) {
    super(
      raw === undefined || raw === null
        ? `缺少完成日期，写成 ${ACCEPTED_FORMS}`
        : `完成日期「${raw instanceof Date ? raw.toISOString() : String(raw)}」无法识别，只能写成 ${ACCEPTED_FORMS}`,
    );
    this.name = 'CompletionDateError';
  }
}

const COMPLETION_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * 接受 frontmatter 里 YAML 解析后的原始值：
 * 未加引号的 2024-03-15 是 Date，2024 是数字，2024-03 和 unknown 是字符串。
 * frontmatter 里写 unknown 表示不记得，归入很久以前。
 *
 * YAML 会把 2024-02-30、2024-13-01 这种不存在的日子悄悄顺延成别的 Date，到这里已经无法分辨；
 * 加了引号的字符串则会被检查出来。带时刻的日期时间（2024-03-15T01:00+09:00）会被拒绝。
 */
export function parseCompletionDate(raw: unknown): CompletionDate {
  if (raw === 'unknown') return { precision: 'long-ago' };

  const written = raw instanceof Date ? dateOnly(raw) : raw;
  if (typeof written !== 'string' && typeof written !== 'number') throw new CompletionDateError(raw);

  const match = COMPLETION_DATE_PATTERN.exec(String(written));
  if (!match) throw new CompletionDateError(raw);

  const [, y, m, d] = match;
  const year = Number(y);
  if (m === undefined) return { precision: 'year', year };

  const month = Number(m);
  if (month < 1 || month > 12) throw new CompletionDateError(raw);
  if (d === undefined) return { precision: 'month', year, month };

  const day = Number(d);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) throw new CompletionDateError(raw);
  return { precision: 'day', year, month, day };
}

/** YAML 解析出的 Date 只有在 UTC 零点时才是一个纯日期；带时刻的不收。 */
function dateOnly(date: Date): string | undefined {
  const iso = date.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : undefined;
}

/**
 * 排序用的比较函数：新的在前，「很久以前」在所有有日期的之后。
 * 同一段时间里只记得大概的（2024）排在记得更具体的（2024-12、2024-01-01）之后。
 */
export function compareCompletionDates(a: CompletionDate, b: CompletionDate): number {
  const keyA = sortKey(a);
  const keyB = sortKey(b);
  for (let i = 0; i < keyA.length; i++) {
    if (keyA[i] !== keyB[i]) return keyB[i] - keyA[i];
  }
  return 0;
}

function sortKey(date: CompletionDate): [number, number, number] {
  switch (date.precision) {
    case 'day':
      return [date.year, date.month, date.day];
    case 'month':
      return [date.year, date.month, 0];
    case 'year':
      return [date.year, 0, 0];
    case 'long-ago':
      return [-Infinity, 0, 0];
  }
}

export function formatCompletionDate(date: CompletionDate): string {
  switch (date.precision) {
    case 'day':
      return `${date.year}年${date.month}月${date.day}日`;
    case 'month':
      return `${date.year}年${date.month}月`;
    case 'year':
      return `${date.year}年`;
    case 'long-ago':
      return '很久以前';
  }
}

/** <time datetime="…"> 的值，精度与记录一致；很久以前没有可写的日期，返回 undefined。 */
export function completionDateTimeAttribute(date: CompletionDate): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (date.precision) {
    case 'day':
      return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    case 'month':
      return `${date.year}-${pad(date.month)}`;
    case 'year':
      return String(date.year);
    case 'long-ago':
      return undefined;
  }
}

/** frontmatter 里 completed 字段的校验：交给 parseCompletionDate，报错原样带出。 */
export const completionDateSchema = z.unknown().transform((raw, ctx): CompletionDate => {
  try {
    return parseCompletionDate(raw);
  } catch (error) {
    if (!(error instanceof CompletionDateError)) throw error;
    ctx.addIssue({ code: 'custom', message: error.message });
    return z.NEVER;
  }
});

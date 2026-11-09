/**
 * PROTOTYPE（首页背景 WebGL 变体）：B 粒子流的记录数据层要用的记录。选定后按正式代码重写，不要直接搬进 main。
 *
 * 现在的种子数据里，49 条记录都是占位封面（同一张灰图）、都没有心头好、完成日期都是「很久以前」。
 * 所以另做一份「示意数据」（?sample=1）：日期、心头好、封面色按 slug 的哈希编出来，只用来看效果。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { coverColor } from '../../lib/cover-color';
import { detailPage } from '../../lib/detail-page';
import { formatCompletionDate, type CompletionDate } from '../../lib/completion-date';
import { originalTitleLang } from '../../lib/original-title';
import { hash01 } from './hash';

export type CategoryKey = 'games' | 'visual-novels' | 'anime' | 'songs';

export interface HeroRecord {
  key: string;
  category: CategoryKey;
  title: string;
  lang?: 'ja';
  /** 有详情页时是详情页，否则是所在类别页 */
  href: string;
  favorite: boolean;
  date: CompletionDate;
  dateLabel: string;
  /** 封面主色 #rrggbb */
  color: string;
}

type AnyRecord =
  | CollectionEntry<'games'>
  | CollectionEntry<'visual-novels'>
  | CollectionEntry<'anime'>
  | CollectionEntry<'songs'>;

const CATEGORY_HREF: Record<CategoryKey, string> = {
  games: '/games/',
  'visual-novels': '/visual-novels/',
  anime: '/anime/',
  songs: '/music/',
};

async function toHeroRecord(entry: AnyRecord): Promise<HeroRecord> {
  const category = entry.collection;
  const date = 'added' in entry.data ? entry.data.added : entry.data.completed;
  const series = 'series' in entry.data ? entry.data.series : undefined;
  return {
    key: `${category}/${entry.data.slug}`,
    category,
    title: entry.data.originalTitle,
    lang: originalTitleLang(entry.data),
    href:
      (category !== 'songs' && detailPage({ ...entry, data: { ...entry.data, series } })?.href) ||
      CATEGORY_HREF[category],
    favorite: entry.data.favorite,
    date,
    dateLabel: formatCompletionDate(date),
    color: entry.data.cover ? await coverColor(entry.data.cover) : '#888888',
  };
}

export async function loadHeroRecords(): Promise<HeroRecord[]> {
  const entries = [
    ...(await getCollection('games')),
    ...(await getCollection('visual-novels')),
    ...(await getCollection('anime')),
    ...(await getCollection('songs')),
  ] as AnyRecord[];
  return Promise.all(entries.map(toHeroRecord));
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * 示意数据：把真实记录的日期、心头好、封面色换成编出来的，只用来看版式。
 * 日期分布在近十年里，约三成留作「很久以前」；约一成五是心头好；封面色是随机色相、中等饱和度。
 */
export function sampleRecords(records: HeroRecord[], now: Date): HeroRecord[] {
  const thisYear = now.getUTCFullYear();
  return records.map((r) => {
    const a = hash01(r.key, 1);
    const b = hash01(r.key, 2);
    let date: CompletionDate;
    if (a < 0.3) date = { precision: 'long-ago' };
    else {
      // 越近的年份越密：大多数在近四五年
      const yearsAgo = Math.floor(Math.pow(b, 1.6) * 10);
      const year = thisYear - yearsAgo;
      const month = 1 + Math.floor(hash01(r.key, 3) * 12);
      date = a < 0.45 ? { precision: 'year', year } : { precision: 'month', year, month: Math.min(month, yearsAgo === 0 ? now.getUTCMonth() + 1 : 12) };
    }
    return {
      ...r,
      favorite: hash01(r.key, 4) < 0.15,
      date,
      dateLabel: formatCompletionDate(date),
      color: hslToHex(hash01(r.key, 5), 0.35 + hash01(r.key, 6) * 0.4, 0.35 + hash01(r.key, 7) * 0.25),
    };
  });
}

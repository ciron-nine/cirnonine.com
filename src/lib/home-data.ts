/**
 * 首页用的数据：四个类别的记录、跨类别最近完成的 5 条、语录候选、头像史。
 * 只做读取和排序，和外观无关（ADR-0002 允许共享的那一层）。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { compareCompletionDates, completionDateTimeAttribute, formatCompletionDate, type CompletionDate } from './completion-date';
import { detailPage } from './detail-page';
import { AVATARS, INTRO } from './home-content';
import { originalTitleLang, quoteLang } from './original-title';

export type CategoryKey = 'games' | 'visual-novels' | 'anime' | 'songs';

export interface HomeRecord {
  category: CategoryKey;
  slug: string;
  originalTitle: string;
  /** 原名是日文时为 'ja'（见 original-title.ts） */
  lang?: 'ja';
  date: CompletionDate;
  dateLabel: string;
  datetime?: string;
  /** 有详情页时是详情页，否则是所在类别页 */
  href: string;
  favorite: boolean;
  /** 所在系列的 id，没有系列时为空 */
  series?: string;
}

export interface HomeCategory {
  key: CategoryKey;
  label: string;
  href: string;
  /** 新到旧，很久以前在最后 */
  records: HomeRecord[];
}

export interface HomeQuote {
  category: CategoryKey;
  original: string;
  lang?: 'ja';
  translation?: string;
  speaker?: string;
  source?: string;
  record: HomeRecord;
}

export interface Avatar {
  /** 头像上的角色 */
  name: string;
  /** 角色出自哪部作品；出自已有记录时带记录 */
  from: { title: string; record?: HomeRecord };
}

export interface HomeData {
  intro: string[];
  categories: HomeCategory[];
  /** 跨类别最近完成的 5 条 */
  recent: HomeRecord[];
  /** 摘录的候选：所有记录的语录，浏览器里随机挑一句；没有语录时为空，摘录不出现 */
  quotes: HomeQuote[];
  /** 第一个是现在的头像 */
  avatars: Avatar[];
}

const CATEGORIES: { key: CategoryKey; label: string; href: string }[] = [
  { key: 'games', label: '游戏', href: '/games/' },
  { key: 'visual-novels', label: '视觉小说', href: '/visual-novels/' },
  { key: 'anime', label: '动画', href: '/anime/' },
  { key: 'songs', label: '音乐', href: '/music/' },
];

type AnyRecord =
  | CollectionEntry<'games'>
  | CollectionEntry<'visual-novels'>
  | CollectionEntry<'anime'>
  | CollectionEntry<'songs'>;

function toHomeRecord(entry: AnyRecord, categoryHref: string): HomeRecord {
  const date = 'added' in entry.data ? entry.data.added : entry.data.completed;
  const series = 'series' in entry.data ? entry.data.series : undefined;
  return {
    category: entry.collection,
    slug: entry.data.slug,
    originalTitle: entry.data.originalTitle,
    lang: originalTitleLang(entry.data),
    date,
    dateLabel: formatCompletionDate(date),
    datetime: completionDateTimeAttribute(date),
    // 单曲永远没有详情页
    href: (entry.collection !== 'songs' && detailPage(entry)?.href) || categoryHref,
    favorite: entry.data.favorite,
    series: series?.id,
  };
}

const byDate = (a: HomeRecord, b: HomeRecord) =>
  compareCompletionDates(a.date, b.date) || a.originalTitle.localeCompare(b.originalTitle);

export async function loadHomeData(): Promise<HomeData> {
  const entries: Record<CategoryKey, AnyRecord[]> = {
    games: await getCollection('games'),
    'visual-novels': await getCollection('visual-novels'),
    anime: await getCollection('anime'),
    songs: await getCollection('songs'),
  };
  const categories = CATEGORIES.map((c) => ({
    ...c,
    records: entries[c.key].map((e) => toHomeRecord(e, c.href)).sort(byDate),
  }));
  const all = categories.flatMap((c) => c.records);
  const find = (category: CategoryKey, slug: string) => all.find((r) => r.category === category && r.slug === slug);

  const quotes: HomeQuote[] = CATEGORIES.flatMap((c) =>
    entries[c.key].flatMap((entry) =>
      entry.data.quotes.map((q) => ({
        category: c.key,
        original: q.original,
        lang: quoteLang(q.original, entry.data),
        translation: q.translation,
        speaker: 'speaker' in q ? q.speaker : undefined,
        source: 'source' in q ? q.source : undefined,
        record: find(c.key, entry.data.slug)!,
      })),
    ),
  );

  return {
    intro: INTRO,
    categories,
    recent: [...all].sort(byDate).slice(0, 5),
    quotes,
    avatars: AVATARS.map(({ name, from, record }) => ({ name, from: { title: from, record: record && find(...record) } })),
  };
}

/**
 * PROTOTYPE（issue #9）：首页三个变体共用的数据。选定方案后按正式代码重写，不要直接搬进 main。
 *
 * 只读真实种子数据：四个类别的记录、系列、语录。种子数据里还没有语录，也还没有头像，
 * 所以语录在没有真实数据时退回到每个类别一句占位，头像史全是占位。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  compareCompletionDates,
  completionDateTimeAttribute,
  formatCompletionDate,
  type CompletionDate,
} from '../../lib/completion-date';
import { detailPage } from '../../lib/detail-page';

export type CategoryKey = 'games' | 'visual-novels' | 'anime' | 'songs';

export interface HomeRecord {
  category: CategoryKey;
  slug: string;
  originalTitle: string;
  translatedTitle?: string;
  /** 原名的语言：有假名的算日文，其余跟随页面（中文或拉丁字母） */
  lang?: 'ja';
  date: CompletionDate;
  dateLabel: string;
  datetime?: string;
  /** 有详情页时是详情页，否则是所在类别页 */
  href: string;
  favorite: boolean;
  shortReview?: string;
  /** 所在系列的 id，没有系列时为空 */
  series?: string;
}

export interface HomeCategory {
  key: CategoryKey;
  label: string;
  /** 首页上说「我…了」时用的动词，比如「玩完了」 */
  verb: string;
  href: string;
  records: HomeRecord[];
}

export interface HomeQuote {
  category: CategoryKey;
  original: string;
  /** 原文的语言：有假名的算日文 */
  lang?: 'ja';
  translation?: string;
  speaker?: string;
  source?: string;
  record: HomeRecord;
  /** 种子数据里没有语录时用的占位 */
  placeholder: boolean;
}

export interface Avatar {
  /** 头像上的角色 */
  name: string;
  /** 角色出自哪部作品；出自已有记录时带记录 */
  from: { title: string; record?: HomeRecord };
}

export interface HomeData {
  /** 自我介绍，按站长气质写的占位文字，一项一段 */
  intro: string[];
  categories: HomeCategory[];
  /** 跨类别最近完成的 5 条记录 */
  recent: HomeRecord[];
  /** 随机语录的候选，页面加载时在浏览器里随机挑一句 */
  quotes: HomeQuote[];
  /** 头像史，第一个是现在的头像 */
  avatars: Avatar[];
  /** 全站记录总数 */
  total: number;
}

const INTRO = [
  '我是 cirnonine。',
  '这里记下的，是我从头走到尾的那些游戏、视觉小说、动画，和听完没舍得删的歌。很多已经想不起是哪一年，只记得那时候的房间，和窗外的天色。',
  '这里没有分数，也不推荐什么。它们在我身上留下了什么，我就写什么；写不出来的，就先空着。',
];

/** 头像史占位：角色和出处来自站长的描述，顺序（哪个是现在的）待站长确认 */
const AVATARS: { name: string; from: string; record?: [CategoryKey, string] }[] = [
  { name: '小早川凛子', from: 'ラブプラス' },
  { name: '久我山栞', from: '久我山栞の死様手帖', record: ['visual-novels', 'kugayama-shiori-no-shinizama-techou'] },
  { name: '初华', from: 'BanG Dream! Ave Mujica', record: ['anime', 'bang-dream-ave-mujica'] },
  { name: '02', from: 'ダーリン・イン・ザ・フランキス' },
  { name: '大阪', from: 'あずまんが大王' },
  { name: '琪露诺', from: '東方Project' },
];

const PLACEHOLDER_QUOTES: Record<CategoryKey, Omit<HomeQuote, 'record' | 'category' | 'placeholder' | 'lang'>> = {
  games: { original: '这里放一句我从这款游戏里带走的台词。', speaker: '说话人' },
  'visual-novels': {
    original: 'ここに、いちばん好きな台詞が入ります。',
    translation: '这里放一句我最喜欢的台词。',
    speaker: '说话人',
  },
  anime: { original: 'ここに字幕の一行が入る。', translation: '这里是一行字幕。', speaker: '说话人' },
  songs: { original: 'ここに一行の歌詞が入る', translation: '这里放一句歌词' },
};

const KANA = /[぀-ヿ]/;

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

function toHomeRecord(entry: AnyRecord): HomeRecord {
  const category = entry.collection;
  const date = 'added' in entry.data ? entry.data.added : entry.data.completed;
  const series = 'series' in entry.data ? entry.data.series : undefined;
  return {
    category,
    slug: entry.data.slug,
    originalTitle: entry.data.originalTitle,
    translatedTitle: entry.data.translatedTitle,
    lang: KANA.test(entry.data.originalTitle) ? 'ja' : undefined,
    date,
    dateLabel: formatCompletionDate(date),
    datetime: completionDateTimeAttribute(date),
    // 单曲永远没有详情页
    href:
      (category !== 'songs' && detailPage({ ...entry, data: { ...entry.data, series } })?.href) ||
      CATEGORY_HREF[category],
    favorite: entry.data.favorite,
    shortReview: entry.data.shortReview,
    series: series?.id,
  };
}

const byDate = (a: HomeRecord, b: HomeRecord) =>
  compareCompletionDates(a.date, b.date) || a.originalTitle.localeCompare(b.originalTitle);

export async function loadHomeData(): Promise<HomeData> {
  const raw = {
    games: await getCollection('games'),
    'visual-novels': await getCollection('visual-novels'),
    anime: await getCollection('anime'),
    songs: await getCollection('songs'),
  };

  const meta: Record<CategoryKey, { label: string; verb: string }> = {
    games: { label: '游戏', verb: '玩完了' },
    'visual-novels': { label: '视觉小说', verb: '读完了' },
    anime: { label: '动画', verb: '看完了' },
    songs: { label: '音乐', verb: '留下了' },
  };

  const categories = (Object.keys(meta) as CategoryKey[]).map((key) => ({
    key,
    ...meta[key],
    href: CATEGORY_HREF[key],
    records: (raw[key] as AnyRecord[]).map(toHomeRecord).sort(byDate),
  }));
  const all = categories.flatMap((c) => c.records);
  const find = (category: CategoryKey, slug: string) =>
    all.find((r) => r.category === category && r.slug === slug);

  const realQuotes: HomeQuote[] = (Object.values(raw).flat() as AnyRecord[]).flatMap((entry) =>
    entry.data.quotes.map((q) => ({
      category: entry.collection,
      original: q.original,
      lang: KANA.test(q.original) ? ('ja' as const) : undefined,
      translation: q.translation,
      speaker: 'speaker' in q ? q.speaker : undefined,
      source: 'source' in q ? q.source : undefined,
      record: find(entry.collection, entry.data.slug)!,
      placeholder: false,
    })),
  );
  const quotes =
    realQuotes.length > 0
      ? realQuotes
      : categories
          .filter((c) => c.records.length > 0)
          .map((c) => {
            const quote = PLACEHOLDER_QUOTES[c.key];
            return {
              category: c.key,
              ...quote,
              lang: KANA.test(quote.original) ? ('ja' as const) : undefined,
              record: c.records[0],
              placeholder: true,
            };
          });

  return {
    intro: INTRO,
    categories,
    recent: [...all].sort(byDate).slice(0, 5),
    quotes,
    avatars: AVATARS.map(({ name, from, record }) => ({
      name,
      from: { title: from, record: record && find(...record) },
    })),
    total: all.length,
  };
}

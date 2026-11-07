import { existsSync, readdirSync } from 'node:fs';
import { defineCollection, reference, type ImageFunction } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ANIME_SEASONS } from './lib/anime-premiere';
import { completionDateSchema } from './lib/completion-date';

/** 内容目录。构建产物测试用 CONTENT_ROOT 指向 tests/fixtures/<name>。 */
const contentRoot = process.env.CONTENT_ROOT ?? 'src/content';

const slug = z
  .string({ error: '缺少 slug（链接里用的英文或罗马字名字，例如 hotline-miami）' })
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug 只能用小写 ASCII 字母、数字和连字符，用英文或罗马字，例如 hotline-miami',
  );

const originalTitle = z
  .string({ error: '缺少原名（作品首次发行时的官方标题）' })
  .trim()
  .min(1, '原名不能为空');

/**
 * 记录里的 series 字段。Astro 自己的 reference() 碰到不存在的系列只打日志不让构建失败，
 * 所以在这里直接看系列文件在不在：内容校验时就报错，指出是哪条记录、哪个字段。
 */
const seriesReference = z
  .string()
  .superRefine((id, ctx) => {
    if (existsSync(`${seriesDir}/${id}.yaml`) || existsSync(`${seriesDir}/${id}.yml`)) return;
    const known = existsSync(seriesDir)
      ? readdirSync(seriesDir)
          .filter((file) => SERIES_FILE.test(file))
          .map((file) => file.replace(SERIES_FILE, ''))
      : [];
    ctx.addIssue({
      code: 'custom',
      message: `引用了不存在的系列「${id}」。系列定义在 series/<id>.yaml，已有的系列：${known.join('、') || '（还没有定义任何系列）'}`,
    });
  })
  .pipe(reference('series'));

/** 语录：从作品里摘下的一句话。原文和说话人必填，中文译文和出处（第几章、哪一幕）可选。 */
const quote = z.strictObject({
  original: z.string({ error: '语录缺少原文（original）' }).trim().min(1, '语录的原文不能为空'),
  translation: z.string().trim().optional(),
  speaker: z.string({ error: '语录缺少说话人（speaker）' }).trim().min(1, '语录的说话人不能为空'),
  source: z.string().trim().optional(),
});

/** 系列：站长定义的分组，每个系列一个 YAML 文件，文件名就是记录里引用它用的 id。 */
const seriesDir = `${contentRoot}/series`;
const SERIES_FILE = /\.ya?ml$/;

const series = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: seriesDir }),
  schema: z.strictObject({
    originalTitle,
    translatedTitle: z.string().optional(),
  }),
});

/** 每个类别的记录都有、和外观无关的字段（ADR-0002 只允许共享这一层） */
function recordFields(image: ImageFunction) {
  return {
    originalTitle,
    translatedTitle: z.string().optional(),
    slug,
    /** 封面：放在记录旁边的图片，写相对路径，例如 ./hotline-miami.jpg */
    cover: image().optional(),
    shortReview: z.string().optional(),
    favorite: z.boolean().default(false),
  };
}

/** 写了某个类别没有的字段时的报错，hint 补充说明这个类别特意不记录什么 */
function unknownFields(category: string, hint = '') {
  return (issue: { code?: string; keys?: string[] }) =>
    issue.code === 'unrecognized_keys'
      ? `${category}记录没有这些字段：${issue.keys!.join('、')}（检查拼写${hint}）`
      : undefined;
}

/** 必填的一段文字，缺了或空了都报 message */
const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);

/** 一串名字（剧本作者、路线、风格标签…），每一项都不能是空的 */
const names = (what: string) => z.array(z.string().trim().min(1, `${what}里有一项是空的`)).default([]);

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/games` }),
  schema: ({ image }) =>
    z.strictObject(
      {
        ...recordFields(image),
        series: seriesReference.optional(),
        completed: completionDateSchema(),
        quotes: z.array(quote).default([]),
      },
      { error: unknownFields('游戏', '；游戏不记录平台和游玩时长') },
    ),
});

const visualNovels = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/visual-novels` }),
  schema: ({ image }) =>
    z.strictObject(
      {
        ...recordFields(image),
        series: seriesReference.optional(),
        completed: completionDateSchema(),
        quotes: z.array(quote).default([]),
        /** 品牌/会社，例如 ゆずソフト */
        brand: requiredText('缺少品牌/会社（brand）'),
        /** 剧本作者（シナリオ） */
        writers: names('剧本作者（writers）'),
        /** 我完成的路线 */
        routes: names('完成的路线（routes）'),
      },
      { error: unknownFields('视觉小说') },
    ),
});

const YEAR_FORM = '写成四位数字，例如 2009';
const EPISODES_FORM = '集数（episodes）写成正整数，例如 12';

const anime = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/anime` }),
  schema: ({ image }) =>
    z.strictObject(
      {
        ...recordFields(image),
        series: seriesReference.optional(),
        completed: completionDateSchema(),
        quotes: z.array(quote).default([]),
        /** 首播年份 */
        year: z
          .number({ error: `缺少首播年份（year），${YEAR_FORM}` })
          .int(`首播年份（year）${YEAR_FORM}`)
          .min(1900, `首播年份（year）${YEAR_FORM}`)
          .max(2100, `首播年份（year）${YEAR_FORM}`),
        /** 首播季度；剧场版这类不按季度播出的不写 */
        season: z
          .enum(ANIME_SEASONS, {
            error: `首播季度（season）只能写 ${ANIME_SEASONS.join('、')}（1、4、7、10 月开播）；剧场版不写`,
          })
          .optional(),
        /** 集数；剧场版不写 */
        episodes: z.number({ error: EPISODES_FORM }).int(EPISODES_FORM).positive(EPISODES_FORM).optional(),
        /** 制作公司 */
        studio: requiredText('缺少制作公司（studio）'),
      },
      { error: unknownFields('动画') },
    ),
});

/** 单曲的语录是一句歌词：原文必填，中文译文可选，没有说话人 */
const lyric = z.strictObject({
  original: requiredText('歌词语录缺少原文（original）'),
  translation: z.string().trim().optional(),
});

/** 音频放在 R2，通过 media.cirnonine.com 访问（ADR-0003） */
const AUDIO_ORIGIN = 'https://media.cirnonine.com/';

const songs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/songs` }),
  schema: ({ image }) =>
    z.strictObject(
      {
        ...recordFields(image),
        /** 收录日期：我把这首歌收进来的时间，规则和完成日期一样 */
        added: completionDateSchema('收录日期'),
        quotes: z.array(lyric).default([]),
        /** 演唱者（歌手或歌声合成软件） */
        singer: requiredText('缺少演唱者（singer）'),
        /** P 主 / 作曲者，和演唱者分开写 */
        producer: z.string().trim().min(1, 'P 主（producer）不能为空').optional(),
        /** 风格标签，例如 ボカロ、J-pop */
        styles: names('风格标签（styles）'),
        /** 二创、同人改编的原曲；原创曲不写 */
        original: z.string().trim().min(1, '原曲（original）不能为空').optional(),
        /** 外部链接，例如 niconico、YouTube */
        links: z
          .array(
            z.strictObject({
              label: requiredText('外部链接缺少名字（label），例如 niconico'),
              url: z.url({ protocol: /^https?$/, error: '外部链接的 url 要写完整的网址，例如 https://www.nicovideo.jp/watch/sm…' }),
            }),
          )
          .default([]),
        /** 音频地址：先把音频传到 R2，再把地址写在这里 */
        audio: z
          .string()
          .refine(
            (url) => url.startsWith(AUDIO_ORIGIN) && URL.canParse(url),
            `音频地址（audio）要写 R2 上的地址，以 ${AUDIO_ORIGIN} 开头（音频不放进仓库，见 ADR-0003）`,
          )
          .optional(),
      },
      { error: unknownFields('单曲', '；单曲用 added 写收录日期，不用 completed') },
    ),
});

export const collections = { series, games, 'visual-novels': visualNovels, anime, songs };

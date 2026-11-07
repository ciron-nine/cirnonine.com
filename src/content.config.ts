import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
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

/** 语录：从作品里摘下的一句话。原文和说话人必填，中文译文和出处（第几章、哪一幕）可选。 */
const quote = z.strictObject({
  original: z.string({ error: '语录缺少原文（original）' }).trim().min(1, '语录的原文不能为空'),
  translation: z.string().trim().optional(),
  speaker: z.string({ error: '语录缺少说话人（speaker）' }).trim().min(1, '语录的说话人不能为空'),
  source: z.string().trim().optional(),
});

/** 系列：站长定义的分组，每个系列一个 YAML 文件，文件名就是记录里引用它用的 id。 */
const series = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: `${contentRoot}/series` }),
  schema: z.strictObject({
    originalTitle,
    translatedTitle: z.string().optional(),
  }),
});

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/games` }),
  schema: ({ image }) =>
    z.strictObject(
    {
      originalTitle,
      translatedTitle: z.string().optional(),
      slug,
      /** 封面：放在记录旁边的图片，写相对路径，例如 ./hotline-miami.jpg */
      cover: image().optional(),
      series: reference('series').optional(),
      completed: completionDateSchema,
      shortReview: z.string().optional(),
      favorite: z.boolean().default(false),
      quotes: z.array(quote).default([]),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys'
          ? `游戏记录没有这些字段：${issue.keys.join('、')}（检查拼写；游戏不记录平台和游玩时长）`
          : undefined,
    },
  ),
});

export const collections = { series, games };

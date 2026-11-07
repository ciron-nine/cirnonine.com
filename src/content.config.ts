import { defineCollection } from 'astro:content';
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

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${contentRoot}/games` }),
  schema: z.strictObject(
    {
      originalTitle,
      translatedTitle: z.string().optional(),
      slug,
      completed: completionDateSchema,
      shortReview: z.string().optional(),
      favorite: z.boolean().default(false),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys'
          ? `游戏记录没有这些字段：${issue.keys.join('、')}（检查拼写；游戏不记录平台和游玩时长）`
          : undefined,
    },
  ),
});

export const collections = { games };

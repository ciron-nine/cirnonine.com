import { existsSync, readdirSync } from 'node:fs';
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
      series: seriesReference.optional(),
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

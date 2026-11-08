/**
 * 构建时按页面实际用字切字体（ADR-0006）。
 *
 * 构建完成后读出每一页 HTML，按 page-text.ts 的规则分出每种字体要显示的字；源字体里没有的字交给回退字体；
 * 再把每种字体在全站用到的字切成几片（slices.ts），各写成一个 woff2，最后生成 /fonts/faces.css。
 * 开发服务器上没有构建产物，faces.css 直接指向完整的源字体。
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { Blob, Face } from 'harfbuzzjs';
import subsetFont from 'subset-font';
import { textByRole } from './page-text';
import { FONT_FACES_HREF, FONT_ROLES, ROLES_FALLBACK_FIRST, type FontRole } from './roles';
import { planSlices, renderedChars, unicodeRange } from './slices';

/**
 * 一片最多放多少个字。片越小，一页多下载的别页的字越少，但请求越多；
 * 一个汉字在这几种字体里压缩后大约 0.15–0.5 KB，60 个字一片是十几 KB。
 */
const MAX_CHARS_PER_SLICE = 60;

/** 切好的子集缓存在这里，同样的字、同样的源字体不用再切一次 */
const CACHE_DIR = 'node_modules/.cache/cirnonine-fonts';

const require = createRequire(import.meta.url);
const sourcePath = (role: FontRole) => require.resolve(FONT_ROLES[role].source);

export default function fontSubsets(): AstroIntegration {
  let root = process.cwd();
  return {
    name: 'cirnonine:font-subsets',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url?.split('?')[0];
          if (url === FONT_FACES_HREF) {
            res.setHeader('content-type', 'text/css');
            res.end(devFontFaces());
            return;
          }
          const role = /^\/fonts\/source\/([a-z-]+)\.ttf$/.exec(url ?? '')?.[1] as FontRole | undefined;
          if (role && role in FONT_ROLES) {
            res.setHeader('content-type', 'font/ttf');
            res.end(await readFile(sourcePath(role)));
            return;
          }
          next();
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const pages = await readPages(outDir);
        const css: string[] = [];
        const summary: string[] = [];
        for (const role of Object.keys(FONT_ROLES) as FontRole[]) {
          const slices = planSlices(
            pages.map((page) => page[role]),
            MAX_CHARS_PER_SLICE,
          );
          const source = await readFile(sourcePath(role));
          let bytes = 0;
          for (const [index, chars] of slices.entries()) {
            const font = await subsetCached(root, role, source, chars.join(''));
            const name = `${role}-${index}-${createHash('sha256').update(font).digest('hex').slice(0, 8)}.woff2`;
            await mkdir(join(outDir, 'fonts'), { recursive: true });
            await writeFile(join(outDir, 'fonts', name), font);
            css.push(fontFace(FONT_ROLES[role].family, `/fonts/${name}`, unicodeRange(chars)));
            bytes += font.length;
          }
          summary.push(`${role} ${slices.length} 片 ${(bytes / 1024).toFixed(0)} KB`);
        }
        await writeFile(join(outDir, FONT_FACES_HREF), css.join('\n'));
        logger.info(`字体子集：${summary.join('，')}`);
      },
    },
  };
}

/** 读出构建产物里的每一页，按字体分好字；源字体里没有的字已经交给了回退字体 */
async function readPages(outDir: string): Promise<Record<FontRole, string>[]> {
  const files = (await readdir(outDir, { recursive: true }))
    .filter((file) => file.endsWith('.html'))
    .sort();
  const coverage = Object.fromEntries(
    await Promise.all(
      (Object.keys(FONT_ROLES) as FontRole[]).map(async (role) => [role, await unicodesOf(role)] as const),
    ),
  ) as Record<FontRole, Set<number>>;

  return Promise.all(
    files.map(async (file) => {
      const text = textByRole(await readFile(join(outDir, file), 'utf8'));
      const chars = Object.fromEntries(
        Object.entries(text).map(([role, value]) => [role, renderedChars(value)]),
      ) as Record<FontRole, string[]>;
      for (const role of ROLES_FALLBACK_FIRST) {
        const missing = chars[role].filter((char) => !coverage[role].has(char.codePointAt(0)!));
        chars[role] = chars[role].filter((char) => coverage[role].has(char.codePointAt(0)!));
        const fallback = FONT_ROLES[role].fallback;
        if (fallback) chars[fallback].push(...missing);
      }
      for (const role of Object.keys(FONT_ROLES) as FontRole[]) {
        const handOff = FONT_ROLES[role].handOff;
        if (!handOff) continue;
        chars[handOff.to].push(...chars[role].filter((char) => handOff.chars.includes(char)));
        chars[role] = chars[role].filter((char) => !handOff.chars.includes(char));
      }
      return Object.fromEntries(Object.entries(chars).map(([role, list]) => [role, list.join('')])) as Record<
        FontRole,
        string
      >;
    }),
  );
}

/** 源字体里有字形的所有码位 */
async function unicodesOf(role: FontRole): Promise<Set<number>> {
  const face = new Face(new Blob(await readFile(sourcePath(role))), 0);
  return new Set(face.collectUnicodes());
}

async function subsetCached(root: string, role: FontRole, source: Buffer, text: string): Promise<Buffer> {
  const key = createHash('sha256').update(FONT_ROLES[role].source).update('\0').update(text).digest('hex');
  const cached = join(root, CACHE_DIR, `${key}.woff2`);
  if (existsSync(cached)) return readFile(cached);
  const font = await subsetFont(source, text, { targetFormat: 'woff2' });
  await mkdir(join(root, CACHE_DIR), { recursive: true });
  await writeFile(cached, font);
  return font;
}

function fontFace(family: string, src: string, range?: string): string {
  return [
    '@font-face {',
    `  font-family: '${family}';`,
    `  src: url('${src}') format('${src.endsWith('.ttf') ? 'truetype' : 'woff2'}');`,
    '  font-weight: 400;',
    '  font-style: normal;',
    '  font-display: swap;',
    ...(range ? [`  unicode-range: ${range};`] : []),
    '}',
  ].join('\n');
}

/** 开发服务器上的字体样式表：直接用完整的源字体 */
function devFontFaces(): string {
  return (Object.keys(FONT_ROLES) as FontRole[])
    .map((role) => fontFace(FONT_ROLES[role].family, `/fonts/source/${role}.ttf`))
    .join('\n');
}

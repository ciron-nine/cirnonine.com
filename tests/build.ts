import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, type HTMLElement } from 'node-html-parser';

const root = fileURLToPath(new URL('..', import.meta.url));

/** 一次完整 astro build 的测试超时 */
export const BUILD_TIMEOUT = 120_000;

export interface BuildResult {
  ok: boolean;
  /** 构建时 stdout 与 stderr 的合并输出 */
  output: string;
  /** 构建产物所在目录的绝对路径 */
  outDir: string;
  /** 读取生成的页面，例如 page('games/') */
  page(route: string): HTMLElement;
  /** 构建是否生成了这个页面 */
  hasPage(route: string): boolean;
  /** 构建生成的、以 prefix 开头的所有页面路由，例如 routes('music/') → ['music/'] */
  routes(prefix: string): string[];
}

/**
 * 用 tests/fixtures/<fixture>/ 作为内容目录跑一次完整的 astro build。
 * 构建在子进程里进行，和 `pnpm build` 走的是同一条路。
 */
export function buildFixture(fixture: string): BuildResult {
  return runAstroBuild(`tests/fixtures/${fixture}`, `tests/.output/${fixture}`);
}

/** 用站点真正的内容目录 src/content/ 跑一次完整的 astro build，和部署时构建的是同一份内容。 */
export function buildSiteContent(): BuildResult {
  return runAstroBuild('src/content', 'tests/.output/site-content');
}

/** 以 contentRoot 为内容目录（环境变量 CONTENT_ROOT）在子进程里跑 astro build，输出到 outDir。 */
function runAstroBuild(contentRoot: string, outDir: string): BuildResult {
  const result = spawnSync('pnpm', ['exec', 'astro', 'build', '--force', '--outDir', outDir], {
    cwd: root,
    env: { ...process.env, CONTENT_ROOT: contentRoot, NO_COLOR: '1', FORCE_COLOR: '0' },
    encoding: 'utf8',
  });
  const pageFile = (route: string) => `${root}${outDir}/${route.replace(/\/?$/, '/')}index.html`;
  return {
    ok: result.status === 0,
    output: `${result.stdout}\n${result.stderr}`,
    outDir: `${root}${outDir}`,
    page(route) {
      return parse(readFileSync(pageFile(route), 'utf8'));
    },
    hasPage(route) {
      return existsSync(pageFile(route));
    },
    routes(prefix) {
      return readdirSync(`${root}${outDir}`, { recursive: true, encoding: 'utf8' })
        .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
        .map((file) => file.slice(0, -'index.html'.length))
        .filter((route) => route.startsWith(prefix))
        .sort();
    },
  };
}

/** 外壳引用的字体样式表，由构建按页面实际用字生成 */
export const FONT_FACES = '/fonts/faces.css';

export interface FontFace {
  family: string;
  /** 字体文件的地址，例如 /fonts/body-0-1a2b3c4d.woff2 */
  src: string;
  /** unicode-range 里的码位区间，闭区间 */
  ranges: [number, number][];
}

/** 读出构建生成的字体样式表里的每一条 @font-face */
export function fontFaces(build: BuildResult): FontFace[] {
  const css = readFileSync(`${build.outDir}${FONT_FACES}`, 'utf8');
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
    const family = /font-family:\s*['"]?([^'";]+)/.exec(body)![1];
    const src = /url\(['"]?([^'")]+)/.exec(body)![1];
    const ranges = /unicode-range:([^;}]+)/
      .exec(body)![1]
      .split(',')
      .map((range): [number, number] => {
        const [from, to = from] = range.trim().replace(/^U\+/i, '').split('-');
        return [parseInt(from, 16), parseInt(to, 16)];
      });
    return { family, src, ranges };
  });
}

/** text 里有哪些字（不计空白）不在 family 这种字体的任何一个 unicode-range 里 */
export function uncovered(faces: FontFace[], family: string, text: string): string[] {
  const ranges = faces.filter((face) => face.family === family).flatMap((face) => face.ranges);
  return [...new Set(text.replace(/\s/g, ''))].filter((char) => {
    const code = char.codePointAt(0)!;
    return !ranges.some(([from, to]) => code >= from && code <= to);
  });
}

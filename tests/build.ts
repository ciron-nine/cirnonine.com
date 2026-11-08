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

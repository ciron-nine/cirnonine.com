import { readdirSync, readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildSiteContent, fontFaces, type BuildResult } from './build';
import { textByRole } from '../src/fonts/page-text';

/** 每个类别的页面路由和它在 src/content/ 下的记录目录 */
const CATEGORIES = [
  { name: '游戏', route: 'games/', dir: 'games' },
  { name: '视觉小说', route: 'visual-novels/', dir: 'visual-novels' },
  { name: '动画', route: 'anime/', dir: 'anime' },
  { name: '音乐', route: 'music/', dir: 'songs' },
];

/** 一个类别目录里的记录文件数 */
function recordFileCount(dir: string): number {
  const files = readdirSync(new URL(`../src/content/${dir}/`, import.meta.url));
  return files.filter((file) => file.endsWith('.md')).length;
}

let build: BuildResult;
beforeAll(() => {
  build = buildSiteContent();
}, BUILD_TIMEOUT);

describe('站点的真实内容', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  describe.each(CATEGORIES)('$name页', ({ route, dir }) => {
    it('列出这个类别的每一条记录，而且至少有一条', () => {
      const records = build.page(route).querySelectorAll('main article');
      expect(records.length).toBeGreaterThan(0);
      expect(records.length).toBe(recordFileCount(dir));
    });

    it('每条记录都有封面', () => {
      const withoutCover = build
        .page(route)
        .querySelectorAll('main article')
        .filter((article) => !article.querySelector('img'))
        .map((article) => article.querySelector('h2, h3')!.text);
      expect(withoutCover).toEqual([]);
    });
  });

  it('每一页要下载的字体在预算以内：首页 130 KB，其他页 120 KB', () => {
    // 模拟浏览器选字：每段字按它所在的字体栈（Shell.astro、voice.css 里的 font-family）依次找，
    // 第一个 unicode-range 里有这个字的字体就是它用的，那个字体文件就要下载。
    // 首页的星图上有全站所有原名，几乎用到全站的字，所以单独放宽（ADR-0006）；它下过的文件别的页直接用缓存。
    const BUDGET_KB = { home: 130, other: 120 };
    const STACKS: Record<string, string[]> = {
      body: ['cirnonine-body'],
      voice: ['cirnonine-voice', 'cirnonine-voice-ja', 'cirnonine-body'],
      'voice-ja': ['cirnonine-voice-ja', 'cirnonine-voice', 'cirnonine-body'],
      ja: ['cirnonine-ja', 'cirnonine-body'],
    };
    const faces = fontFaces(build).map((face) => ({ ...face, kb: statSync(`${build.outDir}${face.src}`).size / 1024 }));
    const covers = (face: (typeof faces)[number], code: number) => face.ranges.some(([from, to]) => code >= from && code <= to);
    for (const route of build.routes('')) {
      const text = textByRole(readFileSync(`${build.outDir}/${route}index.html`, 'utf8'));
      const used = new Set<(typeof faces)[number]>();
      for (const [role, value] of Object.entries(text)) {
        for (const char of new Set(value.replace(/\s/g, ''))) {
          const code = char.codePointAt(0)!;
          for (const family of STACKS[role]) {
            const face = faces.find((f) => f.family === family && covers(f, code));
            if (face) {
              used.add(face);
              break;
            }
          }
        }
      }
      const kb = [...used].reduce((sum, face) => sum + face.kb, 0);
      expect(kb, route || '首页').toBeLessThan(route === '' ? BUDGET_KB.home : BUDGET_KB.other);
    }
  });
});

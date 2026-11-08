import { readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildSiteContent, type BuildResult } from './build';

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
});

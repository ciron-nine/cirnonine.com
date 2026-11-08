/**
 * PROTOTYPE（issue #9）：首页原型的构建产物检查。选定方案后随原型一起留在 prototype/home 分支。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildFixture, type BuildResult } from './build';

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('首页原型', () => {
  it('首页里有 A、C、D 三个变体，默认只显示 A', () => {
    expect(build.ok, build.output).toBe(true);
    const variants = build.page('').querySelectorAll('[data-prototype-variants] > [data-variant]');
    expect(variants.map((v) => [v.getAttribute('data-variant'), v.hasAttribute('hidden')])).toEqual([
      ['A', false],
      ['C', true],
      ['D', true],
    ]);
  });

  it('生产构建里没有切换条', () => {
    expect(build.page('').querySelector('[data-prototype-switcher]')).toBeNull();
  });

  it('每个变体都有四个类别的入口', () => {
    for (const variant of build.page('').querySelectorAll('[data-variant]')) {
      const hrefs = new Set(variant.querySelectorAll('a').map((a) => a.getAttribute('href')));
      for (const href of ['/games/', '/visual-novels/', '/anime/', '/music/']) {
        expect(hrefs.has(href), `${variant.getAttribute('data-variant')} ${href}`).toBe(true);
      }
    }
  });
});

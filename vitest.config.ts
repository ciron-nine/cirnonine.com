import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // 构建产物测试共用 .astro/ 和 node_modules/.astro 缓存，不能并行跑多次 astro build
    fileParallelism: false,
  },
});

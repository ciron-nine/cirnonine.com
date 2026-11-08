import { defineConfig, devices } from '@playwright/test';

const PORT = 4329;
const OUT_DIR = 'tests/.output/e2e';

/** 浏览器冒烟测试：对 src/content/ 的正式构建跑 astro preview，和部署出去的是同一份静态产物 */
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec astro build --outDir ${OUT_DIR} && pnpm exec astro preview --outDir ${OUT_DIR} --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

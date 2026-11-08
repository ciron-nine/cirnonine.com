import { describe, expect, it } from 'vitest';
import { BUILD_TIMEOUT, buildFixture } from './build';

describe('格式不对的游戏记录让构建失败', () => {
  it.each([
    {
      problem: '缺原名',
      fixture: 'missing-original-title',
      file: 'gris',
      message: /originalTitle.*缺少原名/,
    },
    {
      problem: '完成日期的精度不合法',
      fixture: 'invalid-date-precision',
      file: 'to-the-moon',
      message: /completed.*完成日期「去年夏天」无法识别，只能写成 2024-03-15（到日）、2024-03（到月）、2024（到年）或 unknown/,
    },
    {
      problem: 'slug 不是 ASCII',
      fixture: 'non-ascii-slug',
      file: 'nine-sols.md',
      message: /slug.*只能用小写 ASCII 字母、数字和连字符/,
    },
    {
      problem: '缺开发者',
      fixture: 'game-missing-developer',
      file: 'to-the-moon',
      message: /developer.*缺少开发者/,
    },
    {
      problem: '写了游戏记录没有的字段（平台、游玩时长）',
      fixture: 'unknown-field',
      file: 'sanabi',
      message: /游戏记录没有这些字段.*platform.*playtime/,
    },
    {
      problem: '引用了不存在的系列',
      fixture: 'unknown-series',
      file: 'hotline-miami-2.md',
      // 在内容校验时就报错，作为 series 字段的错误，不依赖哪个页面用到了系列
      message: /^\s*series: 引用了不存在的系列「hotline-miammi」.*已有的系列：hotline-miami/m,
    },
  ])(
    '$problem',
    ({ fixture, file, message }) => {
      const build = buildFixture(fixture);
      expect(build.ok).toBe(false);
      expect(build.output).toContain(file);
      expect(build.output).toMatch(message);
    },
    BUILD_TIMEOUT,
  );
});

describe('格式不对的视觉小说记录让构建失败', () => {
  it.each([
    {
      problem: '缺品牌/会社',
      fixture: 'vn-missing-brand',
      message: /brand.*缺少品牌\/会社/,
    },
    {
      problem: '写了视觉小说记录没有的字段（把 routes 拼成 route）',
      fixture: 'vn-unknown-field',
      message: /视觉小说记录没有这些字段：route/,
    },
  ])(
    '$problem',
    ({ fixture, message }) => {
      const build = buildFixture(fixture);
      expect(build.ok).toBe(false);
      expect(build.output).toContain('senren-banka');
      expect(build.output).toMatch(message);
    },
    BUILD_TIMEOUT,
  );
});

describe('格式不对的动画记录让构建失败', () => {
  it.each([
    {
      problem: '首播季度写成了月份',
      fixture: 'anime-invalid-season',
      message: /season.*首播季度（season）只能写 winter、spring、summer、autumn/,
    },
    {
      problem: '集数写成了文字',
      fixture: 'anime-invalid-episodes',
      message: /episodes.*集数（episodes）写成正整数/,
    },
    {
      problem: '缺制作公司',
      fixture: 'anime-missing-studio',
      message: /studio.*缺少制作公司/,
    },
  ])(
    '$problem',
    ({ fixture, message }) => {
      const build = buildFixture(fixture);
      expect(build.ok).toBe(false);
      expect(build.output).toContain('bocchi-the-rock');
      expect(build.output).toMatch(message);
    },
    BUILD_TIMEOUT,
  );
});

describe('格式不对的单曲记录让构建失败', () => {
  it.each([
    {
      problem: '缺演唱者',
      fixture: 'song-missing-singer',
      message: /singer.*缺少演唱者/,
    },
    {
      problem: '外部链接不是完整的网址',
      fixture: 'song-invalid-link',
      message: /links\.0\.url.*外部链接的 url 要写完整的网址/,
    },
    {
      problem: '音频地址不在 R2 上',
      fixture: 'song-audio-not-on-r2',
      message: /audio.*以 https:\/\/media\.cirnonine\.com\/ 开头/,
    },
    {
      problem: '收录日期的精度不合法',
      fixture: 'song-invalid-added',
      message: /added.*收录日期「去年夏天」无法识别，只能写成 2024-03-15（到日）、2024-03（到月）、2024（到年）或 unknown/,
    },
    {
      problem: '把收录日期写成了完成日期',
      fixture: 'song-unknown-field',
      message: /单曲记录没有这些字段：completed.*单曲用 added 写收录日期/,
    },
  ])(
    '$problem',
    ({ fixture, message }) => {
      const build = buildFixture(fixture);
      expect(build.ok).toBe(false);
      expect(build.output).toContain('gunjou');
      expect(build.output).toMatch(message);
    },
    BUILD_TIMEOUT,
  );
});

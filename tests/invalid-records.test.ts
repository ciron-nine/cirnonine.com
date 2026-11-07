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
      problem: '写了游戏记录没有的字段（平台、游玩时长）',
      fixture: 'unknown-field',
      file: 'sanabi',
      message: /游戏记录没有这些字段.*platform.*playtime/,
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

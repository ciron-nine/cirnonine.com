# cirnonine.com

```bash
pnpm install
pnpm dev      # 本地预览
pnpm build    # 构建到 dist/
pnpm check    # 类型检查
pnpm test     # Vitest：单元测试 + 构建产物测试
```

## 添加一条游戏记录

在 `src/content/games/` 新建一个 Markdown 文件：

```markdown
---
originalTitle: Hotline Miami   # 原名，必填
translatedTitle: 火线迈阿密      # 译名，可选
slug: hotline-miami            # 小写 ASCII、连字符分隔，必填
completed: 2024-03-15          # 完成日期，必填：2024-03-15 / 2024-03 / 2024 / unknown（很久以前）
shortReview: 霓虹和噪音          # 短评，可选
favorite: true                 # 心头好，可选，默认 false
---
```

格式不对（缺原名、日期写法不认识、slug 不是 ASCII、写了不存在的字段）时 `pnpm build` 会失败并指出是哪个文件、哪个字段。

注意：YAML 会把未加引号的 `2024-02-30`、`2024-13-01` 这种不存在的日子悄悄顺延成别的日期，构建无法发现；不确定时给日期加引号（`completed: "2024-02-30"`），写错了就会报错。

## 测试

- `src/**/*.test.ts`：纯模块的单元测试（例如 `src/lib/completion-date.ts`）。
- `tests/*.test.ts`：构建产物测试。`tests/build.ts` 的 `buildFixture(name)` 以 `tests/fixtures/<name>/` 作为内容目录（环境变量 `CONTENT_ROOT`）跑一次完整的 `astro build`，输出到 `tests/.output/<name>/`，测试断言生成的 HTML 或构建报错。

## 依赖说明

- `@emnapi/runtime` 固定在 1.11.3：`pnpm check` 用到的 `@astrojs/astro2tsx` 只有 WASM 版本，它的 peer 依赖会被 pnpm 解析成 rolldown 需要的 2.0 beta，与它自带的 `@emnapi/core` 1.x 不兼容，`astro check` 会直接崩溃。上游修好后可以删掉。

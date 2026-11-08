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
developer: Dennaton Games      # 开发者（制作组），必填；发行商不记
cover: ./hotline-miami.jpg     # 封面，放在记录旁边；还没有封面时写 ../placeholder-cover.png
completed: 2024-03-15          # 完成日期，必填：2024-03-15 / 2024-03 / 2024 / unknown（很久以前）
shortReview: 霓虹和噪音          # 短评，可选
favorite: true                 # 心头好，可选，默认 false
---
```

格式不对（缺原名或开发者、日期写法不认识、slug 不是 ASCII、写了不存在的字段）时 `pnpm build` 会失败并指出是哪个文件、哪个字段。

注意：YAML 会把未加引号的 `2024-02-30`、`2024-13-01` 这种不存在的日子悄悄顺延成别的日期，构建无法发现；不确定时给日期加引号（`completed: "2024-02-30"`），写错了就会报错。

## 测试

- `src/**/*.test.ts`：纯模块的单元测试（例如 `src/lib/completion-date.ts`）。
- `tests/*.test.ts`：构建产物测试。`tests/build.ts` 的 `buildFixture(name)` 以 `tests/fixtures/<name>/` 作为内容目录（环境变量 `CONTENT_ROOT`）跑一次完整的 `astro build`，输出到 `tests/.output/<name>/`，测试断言生成的 HTML 或构建报错。
- `tests/site-content.test.ts`：用真正的 `src/content/` 构建一次（`buildSiteContent()`），检查四个类别页列出了每一条记录、每条都有封面（所以 `src/content/` 里的记录都要写 `cover`，还没有封面就用占位图）。它不对具体作品断言，增删记录不用改测试。

## 部署

站点托管在 Cloudflare Pages（ADR-0001），push 到 `main` 自动上线，PR 自动生成预览地址；音频放在 R2，通过 `media.cirnonine.com` 访问（ADR-0003）。后台的一次性设置（Pages 项目、nameserver、域名绑定、`www` 跳转、R2 桶）由向导带着做：

```bash
scripts/setup-deploy.sh
```

能从外部检测的步骤（nameserver、DNSSEC、Pages 项目、域名绑定、`www` 跳转、`media` 域名）做完后会自动跳过，中途退出后可以直接重跑；其余步骤会再显示一遍，直接回车即可。它把填过的 nameserver、项目名、桶名写进 `.env`（已在 `.gitignore` 中），重跑时回车沿用。

- Node 版本由 `.node-version` 指定，Cloudflare 构建和本地共用。
- pnpm 版本写在 `package.json` 的 `packageManager`；Cloudflare 不会从 lockfile 推断 pnpm 版本，Pages 项目里要设环境变量 `PNPM_VERSION` 与之一致，改版本时两边一起改。

## 依赖说明

- `@emnapi/runtime` 固定在 1.11.3：`pnpm check` 用到的 `@astrojs/astro2tsx` 只有 WASM 版本，它的 peer 依赖会被 pnpm 解析成 rolldown 需要的 2.0 beta，与它自带的 `@emnapi/core` 1.x 不兼容，`astro check` 会直接崩溃。上游修好后可以删掉。

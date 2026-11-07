# 托管在 Cloudflare Pages，DNS 迁到 Cloudflare

网站托管在 Cloudflare Pages，连接 GitHub 仓库 `ciron-nine/cirnonine.com`，每次 push 到 `main` 由 Cloudflare 构建并发布，PR 自动生成预览地址。主域名是裸域名 `cirnonine.com`，`www` 跳转过去。

## Considered Options

- **GitHub Pages**：同样免费、离仓库更近，但没有 PR 预览，国内访问通常更慢。
- **Cloudflare Workers（静态资源模式）**：Cloudflare 推荐新项目使用，但对纯静态站来说 Pages 的 Git 集成更省事。

## Consequences

Cloudflare Pages 要绑定裸域名，域名必须是 Cloudflare 托管的 zone，所以在 NameSilo 把 nameserver 改成 Cloudflare 的；域名注册仍留在 NameSilo。以后所有 DNS 记录都在 Cloudflare 里管理。

# 音频放在 Cloudflare R2，不放进仓库

背景音乐和单曲的音频文件放在 Cloudflare R2，通过 `media.cirnonine.com` 访问；图片仍然放在仓库里由 Astro 优化。音频每首几 MB，放进 git 会让仓库迅速膨胀，而 Cloudflare Pages 的 Git 构建不支持 Git LFS。

## Consequences

加一首歌是两步：把音频上传到 R2，再在仓库里写记录并引用它的地址。本地开发时音频也从 R2 读取。

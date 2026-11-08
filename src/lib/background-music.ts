/**
 * 全站和各类别的背景音乐地址。页面在 <Shell music={…}> 里声明自己用哪一层，规则见 src/lib/playback.ts。
 * 正式曲目放在 R2（ADR-0003）；换曲时上传成新文件名再改这里，不要覆盖旧文件，免得 Cloudflare 缓存还在给旧的。
 */
import { placeholderMusic } from './placeholder-audio';

/** 全站背景音乐：Malachi Bailey「Under the stars」 */
export const SITE_MUSIC = 'https://media.cirnonine.com/background-music/under-the-stars.m4a';

/** 各类别的背景音乐，暂用占位音频；音乐类别没有背景音乐 */
export const CATEGORY_MUSIC = {
  games: placeholderMusic('games'),
  'visual-novels': placeholderMusic('visual-novels'),
  anime: placeholderMusic('anime'),
};

/**
 * 原名的语言。页面是中文（zh-CN），所以只有日文原名需要标出来：它要用日文字体排版，读屏也要换成日语读。
 * 有假名的原名自动算日文；全是汉字的日文原名（群青、千本桜）看不出来，记录里写 lang: ja。
 */
export const ORIGINAL_TITLE_LANGS = ['ja'] as const;
export type OriginalTitleLang = (typeof ORIGINAL_TITLE_LANGS)[number];

/** 平假名和片假名（含长音符） */
const KANA = /[぀-ヿ]/;

/** 写在原名所在元素上的 lang 属性：日文是 'ja'，其余跟随页面，返回 undefined */
export function originalTitleLang(data: { originalTitle: string; lang?: OriginalTitleLang }): 'ja' | undefined {
  return data.lang === 'ja' || KANA.test(data.originalTitle) ? 'ja' : undefined;
}

/** 汉字（含扩展 A 和兼容区里常见的部分） */
const HAN = /[㐀-鿿豈-﫿]/;

/**
 * 一句语录原文所在元素的 lang：有假名的是日文；全是汉字时跟随记录的原名
 * （日文作品里的汉字台词按日文排），拉丁字母的台词跟随页面。
 */
export function quoteLang(original: string, record: Parameters<typeof originalTitleLang>[0]): 'ja' | undefined {
  if (KANA.test(original)) return 'ja';
  return HAN.test(original) ? originalTitleLang(record) : undefined;
}

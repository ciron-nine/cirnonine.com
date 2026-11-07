/** 动画首播的季度：日本动画按 1 月、4 月、7 月、10 月开播分成冬、春、夏、秋四季 */
export const ANIME_SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
export type AnimeSeason = (typeof ANIME_SEASONS)[number];

const SEASON_LABELS: Record<AnimeSeason, string> = {
  winter: '冬季',
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
};

/** 首播时间的显示文字：2022年秋季；剧场版这类没有季度的只写年份 */
export function formatPremiere(year: number, season?: AnimeSeason): string {
  return season ? `${year}年${SEASON_LABELS[season]}` : `${year}年`;
}

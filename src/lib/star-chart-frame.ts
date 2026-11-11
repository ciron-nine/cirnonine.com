/**
 * 记录星图的画框：svg 的 viewBox 是 0 0 SIZE SIZE，天球是圆心在 (CENTER, CENTER)、半径 RADIUS 的圆。
 * 构建时的几何（star-chart.ts）和浏览器里的缩放、准星（components/home/star-chart.ts）共用这几个数。
 */
export const SIZE = 1000;
export const CENTER = SIZE / 2;
export const RADIUS = 482;

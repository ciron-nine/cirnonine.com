/**
 * PROTOTYPE（第四轮）：小册子翻到哪儿了，交给星空的镜头。
 * 0 是合着（星空），1 是翻开第一页（行星），2 是翻到第二页（星系）；中间连续变化。
 * 小册子（booklet.ts）写，星空（cosmos.ts）每一帧读。
 */
let value = 0;

export function setBookProgress(next: number): void {
  value = next;
}

export function bookProgress(): number {
  return value;
}

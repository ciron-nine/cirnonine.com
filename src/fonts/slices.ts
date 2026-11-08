/**
 * 把一种字体在全站用到的字切成几片，每片是一个字体文件、一条带 unicode-range 的 @font-face。
 * 浏览器只下载当前页面用到的那几片，换页时已经下过的片直接用缓存。
 *
 * 排法：出现在越多页面上的字越靠前（导航、日期这些每页都有的字落在第一片）；
 * 次数一样的按第一次出现的页面排在一起，一篇长评里独有的字就会聚在同几片里，不会摊到别的页面上去。
 */
export function planSlices(pages: string[], maxCharsPerSlice: number): string[][] {
  const pageCount = new Map<string, number>();
  const firstPage = new Map<string, number>();
  pages.forEach((text, index) => {
    for (const char of new Set(renderedChars(text))) {
      pageCount.set(char, (pageCount.get(char) ?? 0) + 1);
      if (!firstPage.has(char)) firstPage.set(char, index);
    }
  });

  const ordered = [...pageCount.keys()].sort(
    (a, b) =>
      pageCount.get(b)! - pageCount.get(a)! ||
      firstPage.get(a)! - firstPage.get(b)! ||
      a.codePointAt(0)! - b.codePointAt(0)!,
  );
  const slices: string[][] = [];
  for (let i = 0; i < ordered.length; i += maxCharsPerSlice) slices.push(ordered.slice(i, i + maxCharsPerSlice));
  return slices;
}

/** 文字里真正要画出来的字：去掉换行、制表这类控制字符，空格留着（混排时空格也要用同一种字体的宽度） */
export function renderedChars(text: string): string[] {
  return [...text.replace(/[\s ]+/g, ' ')].filter((char) => char.codePointAt(0)! >= 0x20);
}

/** 一组字写成 unicode-range 的值，连续的码位合成一段，例如 U+20,U+4E00-4E02 */
export function unicodeRange(chars: string[]): string {
  const codes = [...new Set(chars.map((char) => char.codePointAt(0)!))].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < codes.length; i++) {
    const start = codes[i];
    while (codes[i + 1] === codes[i] + 1) i++;
    const hex = (code: number) => code.toString(16).toUpperCase();
    ranges.push(start === codes[i] ? `U+${hex(start)}` : `U+${hex(start)}-${hex(codes[i])}`);
  }
  return ranges.join(',');
}

/**
 * PROTOTYPE 变体 C：从记录的封面主色里挑出极光的几种颜色。
 * 心头好的封面优先；彼此太像的颜色只留一个；最多四种。rand 由调用方给：
 * 构建时用固定种子（静态后备每次一样），浏览器里用 Math.random（每次来看到的极光颜色不同）。
 */

export interface PaletteSource {
  color: string;
  favorite: boolean;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function pickPalette(sources: PaletteSource[], rand: () => number, max = 4): string[] {
  const unique = new Map<string, PaletteSource>();
  for (const s of sources) {
    const prev = unique.get(s.color);
    if (!prev || (s.favorite && !prev.favorite)) unique.set(s.color, s);
  }
  const shuffled = [...unique.values()]
    .map((s) => ({ s, k: rand() - (s.favorite ? 1 : 0) }))
    .sort((a, b) => a.k - b.k)
    .map(({ s }) => s.color);
  const picked: string[] = [];
  for (const color of shuffled) {
    if (picked.length >= max) break;
    const rgb = hexToRgb(color);
    if (picked.every((p) => distance(hexToRgb(p), rgb) > 0.22)) picked.push(color);
  }
  return picked;
}

/** 极光是发光的：保留色相和饱和度，把最亮的通道提到 0.9 */
export function glow(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  const m = Math.max(...rgb, 0.001);
  return rgb.map((v) => (v / m) * 0.9) as [number, number, number];
}

/** 固定种子的伪随机，给构建时用 */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

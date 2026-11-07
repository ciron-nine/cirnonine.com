import type { ImageMetadata } from 'astro';
import sharp from 'sharp';

const colors = new Map<string, Promise<string>>();

/**
 * 封面的主色（#rrggbb），构建时用 sharp 的直方图取占比最大的颜色。
 * 同一张封面在多个页面上用到时只算一次。
 */
export function coverColor(cover: ImageMetadata): Promise<string> {
  // Astro 在 import / 内容集合解析出的图片上带着不可枚举的 fsPath（它自己的 getImage 也靠它找原图）
  const path = (cover as ImageMetadata & { fsPath?: string }).fsPath;
  if (!path) throw new Error(`拿不到封面 ${cover.src} 的原图路径，无法提取主色`);

  let color = colors.get(path);
  if (!color) {
    color = sharp(path)
      .stats()
      .then(({ dominant: { r, g, b } }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    colors.set(path, color);
  }
  return color;
}

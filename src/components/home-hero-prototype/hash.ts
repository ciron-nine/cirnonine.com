/** PROTOTYPE：构建时和浏览器里都能用的小工具（不碰 astro:content） */

/** 0..1 的稳定哈希，同一个 key 每次构建结果一样 */
export function hash01(key: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

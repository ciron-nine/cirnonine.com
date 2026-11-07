/**
 * 专属页登记。新增一个专属页 = 写好那个页面，再在这里登记它的地址。
 */
export interface BespokePages {
  /** 记录的专属页，键是「类别/slug」，例如 games/to-the-moon */
  records: Record<string, string>;
  /** 系列的专属页，键是系列 id；系列里每一部是页里的一个章节，章节锚点是记录的 slug */
  series: Record<string, string>;
}

export const bespokePages: BespokePages = {
  records: {},
  series: {},
};

/** 能套用详情页规则的记录：任何类别的内容集合条目 */
interface RecordEntry {
  collection: string;
  body?: string;
  data: { slug: string; series?: { id: string } };
}

export type DetailPage = { kind: 'bespoke'; href: string } | { kind: 'default'; href: string };

/**
 * 详情页规则：有专属页（记录自己的，或所在系列的）→ 专属页；
 * 否则有长评 → 类别默认详情页；否则没有详情页（返回 undefined）。
 */
export function detailPage(record: RecordEntry, bespoke: BespokePages = bespokePages): DetailPage | undefined {
  const { slug, series } = record.data;
  const own = bespoke.records[`${record.collection}/${slug}`];
  if (own) return { kind: 'bespoke', href: own };

  const seriesPage = series && bespoke.series[series.id];
  if (seriesPage) return { kind: 'bespoke', href: `${seriesPage}#${slug}` };

  if (record.body?.trim()) return { kind: 'default', href: `/${record.collection}/${slug}/` };
  return undefined;
}

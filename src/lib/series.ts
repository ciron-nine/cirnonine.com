import type { CollectionEntry } from 'astro:content';

type Series = CollectionEntry<'series'>;

/** 任何类别的记录，只要能引用系列 */
interface SeriesMember {
  id: string;
  data: { series?: { id: string } };
}

/** 类别页上的一项：单独一条记录，或同一系列的几条记录叠成的一摞 */
export type StackedEntry<R> =
  | { kind: 'record'; record: R }
  | { kind: 'stack'; series: Series; records: R[] };

/**
 * 把已经排好序的记录按系列叠起来。一摞出现在它最靠前的成员所在的位置，摞内保持原来的顺序。
 * 系列引用在内容校验时已经检查过（content.config.ts），这里拿到的都是存在的系列。
 */
export function stackBySeries<R extends SeriesMember>(records: R[], allSeries: Series[]): StackedEntry<R>[] {
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));
  const members = new Map<string, R[]>();
  for (const record of records) {
    const ref = record.data.series;
    if (!ref) continue;
    members.set(ref.id, [...(members.get(ref.id) ?? []), record]);
  }

  const result: StackedEntry<R>[] = [];
  const placed = new Set<string>();
  for (const record of records) {
    const id = record.data.series?.id;
    if (!id) {
      result.push({ kind: 'record', record });
    } else if (!placed.has(id)) {
      placed.add(id);
      result.push({ kind: 'stack', series: seriesById.get(id)!, records: members.get(id)! });
    }
  }
  return result;
}

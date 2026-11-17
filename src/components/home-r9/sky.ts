/**
 * PROTOTYPE（首页第九轮）：北辰。这一页的「数」全部出自中国古代的盖天式星图（苏州石刻天文图那一类）：
 * - 周天 365¼ 古度（太阳一天走一度），二十八宿按汉代的宿度切开，四象各管七宿：东 75、北 98¼、西 80、南 112
 * - 以北极为圆心，按去极度画圆：内规（恒显圈）、赤道、外规（恒隐圈），黄道和天汉按真实坐标算出来
 * - 五方配五音：东角、南徵、西商、北羽，中央是宫——北辰的位置
 * 这里只放天文和历法的计算，不碰页面。
 */

export type Xiang = 'east' | 'north' | 'west' | 'south';

/** 二十八宿：名字、宿度（古度）、所属四象。斗宿带着那四分之一度 */
export const MANSIONS: [string, number, Xiang][] = [
  ['角', 12, 'east'], ['亢', 9, 'east'], ['氐', 15, 'east'], ['房', 5, 'east'], ['心', 5, 'east'], ['尾', 18, 'east'], ['箕', 11, 'east'],
  ['斗', 26.25, 'north'], ['牛', 8, 'north'], ['女', 12, 'north'], ['虚', 10, 'north'], ['危', 17, 'north'], ['室', 16, 'north'], ['壁', 9, 'north'],
  ['奎', 16, 'west'], ['娄', 12, 'west'], ['胃', 14, 'west'], ['昴', 11, 'west'], ['毕', 16, 'west'], ['觜', 2, 'west'], ['参', 9, 'west'],
  ['井', 33, 'south'], ['鬼', 4, 'south'], ['柳', 15, 'south'], ['星', 7, 'south'], ['张', 18, 'south'], ['翼', 18, 'south'], ['轸', 17, 'south'],
];

export const XIANG: Record<Xiang, { name: string; tone: string }> = {
  east: { name: '东方苍龙', tone: '角' },
  north: { name: '北方玄武', tone: '羽' },
  west: { name: '西方白虎', tone: '商' },
  south: { name: '南方朱雀', tone: '徵' },
};

export const ZHOUTIAN = 365.25;
/** 古度 → 今天的度 */
export const toDeg = (gu: number) => (gu * 360) / ZHOUTIAN;
/** 角宿的起点：角宿一（室女座 α）的赤经 */
const JIAO_RA = 201.3;

/** 每一宿的起止赤经（度） */
export const MANSION_SPANS = (() => {
  let gu = 0;
  return MANSIONS.map(([name, width, xiang]) => {
    const start = JIAO_RA + toDeg(gu);
    gu += width;
    return { name, width, xiang, start, end: JIAO_RA + toDeg(gu) };
  });
})();

/** 每一象的起止赤经 */
export function xiangSpan(x: Xiang): [number, number] {
  const ms = MANSION_SPANS.filter((m) => m.xiang === x);
  return [ms[0].start, ms[ms.length - 1].end];
}

export function mansionAt(ra: number) {
  const a = (((ra - JIAO_RA) % 360) + 360) % 360 + JIAO_RA;
  return MANSION_SPANS.find((m) => a >= m.start && a < m.end) ?? MANSION_SPANS[0];
}

/** 观测地纬度（北纬 35° 上下，和石刻图一样）：内规、外规的去极度由它定 */
export const LATITUDE = 35;
export const NEI_GUI = LATITUDE; // 内规：去极 35°，以内的星终年不落
export const CHIDAO = 90;
export const WAI_GUI = 180 - LATITUDE; // 外规：去极 145°，以外的星终年不出
const LONGITUDE = 116.4; // 北京

const rad = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;

function julian(date: Date) {
  return date.getTime() / 864e5 + 2440587.5;
}

/** 地方恒星时（度）：此刻正好在子午线上的赤经 */
export function localSiderealDeg(date: Date) {
  const d = julian(date) - 2451545;
  return norm(280.46061837 + 360.98564736629 * d + LONGITUDE);
}

const OBLIQUITY = 23.439;

/** 黄经 λ、黄纬 0 的点 → 赤经赤纬 */
export function eclipticToEquatorial(lambda: number): [number, number] {
  const e = OBLIQUITY * rad;
  const l = lambda * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(l)) / rad;
  return [norm(ra), dec];
}

/** 太阳的黄经（度），够画图用的近似 */
export function sunLongitude(date: Date) {
  const n = julian(date) - 2451545;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * rad;
  return norm(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

/** 银道（天汉的中线）上银经 l、银纬 b 的点 → 赤经赤纬（J2000） */
export function galacticToEquatorial(l: number, b: number): [number, number] {
  const raN = 192.85948 * rad;
  const decN = 27.12825 * rad;
  const lN = 122.93192 * rad;
  const L = l * rad;
  const B = b * rad;
  const dec = Math.asin(Math.sin(decN) * Math.sin(B) + Math.cos(decN) * Math.cos(B) * Math.cos(lN - L));
  const ra = raN + Math.atan2(Math.cos(B) * Math.sin(lN - L), Math.cos(decN) * Math.sin(B) - Math.sin(decN) * Math.cos(B) * Math.cos(lN - L));
  return [norm(ra / rad), dec / rad];
}

const JIEQI = ['春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰'];
const DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 小于一百的整数写成汉字：十二、二十六、三十三 */
function cn(n: number) {
  if (n < 10) return DIGIT[n];
  const t = Math.floor(n / 10);
  return `${t > 1 ? DIGIT[t] : ''}十${n % 10 ? DIGIT[n % 10] : ''}`;
}

/** 节气：上一个是什么、过了几天；下一个是什么、还有几天 */
export function jieqi(date: Date) {
  const lam = sunLongitude(date);
  const i = Math.floor(lam / 15);
  const since = Math.floor((lam - i * 15) / 0.9856);
  const until = Math.ceil(((i + 1) * 15 - lam) / 0.9856);
  return { last: JIEQI[i], since, next: JIEQI[(i + 1) % 24], until, cn };
}

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const KE = ['初刻', '一刻', '二刻', '三刻'];

/** 时辰：子时从 23 点起；每个时辰分初、正，各四刻 */
export function shichen(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const idx = Math.floor(((h + 1) % 24) / 2);
  const zheng = (h + 1) % 2 === 1;
  return `${ZHI[idx]}${zheng ? '正' : '初'}${KE[Math.floor(m / 15)]}`;
}

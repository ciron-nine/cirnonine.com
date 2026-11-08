/**
 * 字体方案：外壳里的四种字体，每种在页面上管一类文字（ADR-0006）。
 *
 * - 正文：导航、译名、开发者这些作品资料和界面文字。思源黑体，安静、中性。
 * - 我的声音：短评、长评、我挑的语录、心头好、完成日期和收录日期。霞鹜文楷；里面的日文落到同一母本的 Klee One。
 * - 日文：作品的日文原名、日文语录原文。Shippori Mincho。
 *
 * 哪段文字归哪种字体，由页面结构决定：在 .voice 里的是我的声音，在 lang="ja" 里的是日文（见 page-text.ts）。
 * Shell.astro 里的 font-family 写法要和这里的 family 名、回退顺序保持一致。
 */
export type FontRole = 'body' | 'voice' | 'voice-ja' | 'ja';

export interface FontRoleConfig {
  /** @font-face 里的 font-family 名 */
  family: string;
  /** 完整的源字体文件（npm 包里的路径），构建时从它切子集 */
  source: string;
  /** 这种字体里没有的字交给哪种字体；没有写的是正文，缺字交给系统字体 */
  fallback?: FontRole;
  /** 这种字体里有、但字形不合用的字，交给另一种字体（它在 CSS 里要排在这种字体后面） */
  handOff?: { chars: string; to: FontRole };
}

export const FONT_ROLES: Record<FontRole, FontRoleConfig> = {
  body: {
    family: 'cirnonine-body',
    source: '@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf',
  },
  voice: {
    family: 'cirnonine-voice',
    // npm 上只有霞鹜文楷 TC 有完整字体文件；它收了全部简体字，共用的字按台湾字形
    source: '@expo-google-fonts/lxgw-wenkai-tc/400Regular/LXGWWenKaiTC_400Regular.ttf',
    fallback: 'body',
    // TC 版的逗号、句号、顿号按台湾写法放在字身正中；简体要靠左下，借同一母本的 Klee One
    handOff: { chars: '，。、', to: 'voice-ja' },
  },
  'voice-ja': {
    family: 'cirnonine-voice-ja',
    source: '@expo-google-fonts/klee-one/400Regular/KleeOne_400Regular.ttf',
    fallback: 'voice',
  },
  ja: {
    family: 'cirnonine-ja',
    source: '@expo-google-fonts/shippori-mincho/400Regular/ShipporiMincho_400Regular.ttf',
    fallback: 'body',
  },
};

/** 缺字往回退的方向：先处理会把字交出去的，正文最后 */
export const ROLES_FALLBACK_FIRST: FontRole[] = ['voice-ja', 'ja', 'voice', 'body'];

/** 字体样式表的地址，外壳在每一页的 <head> 里引用它 */
export const FONT_FACES_HREF = '/fonts/faces.css';

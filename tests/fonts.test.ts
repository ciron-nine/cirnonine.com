import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { BUILD_TIMEOUT, buildFixture, fontFaces, FONT_FACES, uncovered, type BuildResult } from './build';

const CATEGORY_PAGES = ['games/', 'visual-novels/', 'anime/', 'music/'];

/** 外壳里每种字体的 font-family 名 */
const FAMILY = {
  body: 'cirnonine-body',
  voice: 'cirnonine-voice',
  voiceJa: 'cirnonine-voice-ja',
  ja: 'cirnonine-ja',
};

/** 一个元素实际所在的语言：自己或最近的祖先上写的 lang */
function langOf(element: HTMLElement): string | undefined {
  for (let el: HTMLElement | null = element; el; el = el.parentNode) {
    const lang = el.getAttribute?.('lang');
    if (lang) return lang;
  }
  return undefined;
}

/** 类别页上作为标题出现的原名（记录和系列的 h2、h3），和它们所在的语言 */
function titleLangs(build: BuildResult): Map<string, string | undefined> {
  const langs = new Map<string, string | undefined>();
  for (const route of CATEGORY_PAGES) {
    for (const heading of build.page(route).querySelectorAll('main h2, main h3')) {
      langs.set(heading.text.trim(), langOf(heading.querySelector('a') ?? heading));
    }
  }
  return langs;
}

let build: BuildResult;
beforeAll(() => {
  build = buildFixture('valid');
}, BUILD_TIMEOUT);

describe('字体方案', () => {
  it('每一页都引用同一份字体样式表，样式表里写到的字体文件都生成了', () => {
    for (const route of build.routes('')) {
      const links = build.page(route).querySelectorAll('head link[rel="stylesheet"]');
      expect(
        links.map((link) => link.getAttribute('href')),
        route,
      ).toContain(FONT_FACES);
    }
    const faces = fontFaces(build);
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) expect(existsSync(`${build.outDir}${face.src}`), face.src).toBe(true);
  });

  it('正文、日文原名各自的字体只收页面上真正用到的字', () => {
    const faces = fontFaces(build);
    // 正文：译名、开发者、导航
    expect(uncovered(faces, FAMILY.body, '火线迈阿密 Dennaton Games 九日 海沙风云 游戏视觉小说动画音乐')).toEqual([]);
    // 日文原名：带假名的和写了 lang: ja 的
    expect(uncovered(faces, FAMILY.ja, 'けいおん！ぼっち・ざ・ろっく群青千本桜日常')).toEqual([]);
    // 中文原名不进日文字体
    expect(uncovered(faces, FAMILY.ja, '九').length).toBe(1);
    // 没有用到的字哪种字体都不收
    for (const family of Object.values(FAMILY)) expect(uncovered(faces, family, '鬱'), family).toEqual(['鬱']);
  });
});

describe('原名的语言', () => {
  it('构建成功', () => {
    expect(build.ok, build.output).toBe(true);
  });

  it('有假名的原名、和写了 lang: ja 的全汉字原名都标成日文', () => {
    const langs = titleLangs(build);
    for (const title of [
      'けいおん！',
      'ぼっち・ざ・ろっく！',
      'タイムパラドックス',
      '美少女万華鏡 -呪われし伝説の少女-',
      // 全是汉字的日文原名，记录里写了 lang: ja
      '群青',
      '千本桜',
      '日常',
      '千恋＊万花',
      // 系列名
      '美少女万華鏡',
    ]) {
      expect(langs.get(title), title).toBe('ja');
    }
  });

  it('中文和拉丁字母的原名跟随页面语言', () => {
    const langs = titleLangs(build);
    for (const title of ['九日', '海沙风云', 'Hotline Miami', 'SANABI', 'ATRI -My Dear Moments-']) {
      expect(langs.get(title), title).toBe('zh-CN');
    }
  });
});

describe('我的声音', () => {
  it('短评、心头好、完成日期和收录日期在每个类别页上都用我的声音的字体', () => {
    const faces = fontFaces(build);
    // 四个类别各一条短评，心头好，日期里的数字和年月日，很久以前
    const voice = '霓虹和噪音海面下的夏天吉他和纸箱永远的开场曲心头好2024年3月15日很久以前';
    expect(uncovered(faces, FAMILY.voice, voice)).toEqual([]);
    // 这些字不是作品资料，正文字体里不该为它们多收
    expect(uncovered(faces, FAMILY.body, '霓虹噪').length).toBe(3);
  });

  it('语录的中文译文是我的声音，日文原文用日文字体', () => {
    const faces = fontFaces(build);
    expect(uncovered(faces, FAMILY.voice, '你喜欢伤害别人吗？触碰到天使了！大胆无畏的摩登革命')).toEqual([]);
    expect(uncovered(faces, FAMILY.ja, '天使にふれたよ！私は高性能ですから大胆不敵にハイカラ革命')).toEqual([]);
  });

  it('长评用我的声音', () => {
    const faces = fontFaces(build);
    expect(uncovered(faces, FAMILY.voice, '凌晨三点的霓虹和一直响着的电话沉在水里的小镇')).toEqual([]);
  });

  it('我的声音里的逗号、句号、顿号按简体写法靠左下：借同一母本的 Klee One，不用霞鹜文楷 TC 居中的那种', () => {
    const faces = fontFaces(build);
    expect(uncovered(faces, FAMILY.voice, '，。').sort()).toEqual(['。', '，']);
    expect(uncovered(faces, FAMILY.voiceJa, '，。')).toEqual([]);
  });

  it('同一种我的声音在每一页上都是同一个样子', () => {
    /** 一页上某段文字所在元素的标签和 class */
    const shape = (route: string, text: string) => {
      const element = build
        .page(route)
        .querySelectorAll('main *')
        .findLast((el) => el.text.trim() === text);
      expect(element, `${route} ${text}`).toBeDefined();
      return `${element!.rawTagName} ${element!.classList.value.filter((c) => !c.startsWith('astro-')).join(' ')}`;
    };
    const favorites = ['games/', 'visual-novels/', 'anime/', 'music/', 'games/hotline-miami/'].map((route) =>
      shape(route, '心头好'),
    );
    expect(new Set(favorites).size, favorites.join(' | ')).toBe(1);
    const reviews = [
      shape('games/', '霓虹和噪音'),
      shape('visual-novels/', '海面下的夏天'),
      shape('anime/', '吉他和纸箱'),
      shape('music/', '永远的开场曲'),
    ];
    expect(new Set(reviews).size, reviews.join(' | ')).toBe(1);
  });
});

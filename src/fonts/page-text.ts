import { parse, type HTMLElement, type Node } from 'node-html-parser';
import type { FontRole } from './roles';

/** 不显示成文字的元素 */
const NOT_RENDERED = new Set(['script', 'style', 'template', 'noscript']);

/**
 * 一页 HTML 里每种字体要显示的字，和 CSS 的规则一致：
 * 在 class="voice" 里的是我的声音，所在语言（自己或最近祖先的 lang）是日文的是日文；两者都是就是我的声音里的日文。
 */
export function textByRole(html: string): Record<FontRole, string> {
  const text: Record<FontRole, string[]> = { body: [], voice: [], 'voice-ja': [], ja: [] };
  const root = parse(html);
  const body = root.querySelector('body');
  if (!body) return { body: '', voice: '', 'voice-ja': '', ja: '' };

  const walk = (node: Node, voice: boolean, ja: boolean) => {
    if (node.nodeType === 3) {
      const role: FontRole = voice ? (ja ? 'voice-ja' : 'voice') : ja ? 'ja' : 'body';
      text[role].push(node.text);
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    if (NOT_RENDERED.has(element.rawTagName?.toLowerCase())) return;
    const lang = element.getAttribute('lang');
    const inVoice = voice || element.classList.contains('voice');
    const inJa = lang ? /^ja\b/i.test(lang) : ja;
    for (const child of element.childNodes) walk(child, inVoice, inJa);
  };
  walk(body, false, /^ja\b/i.test(root.querySelector('html')?.getAttribute('lang') ?? ''));

  return {
    body: text.body.join(''),
    voice: text.voice.join(''),
    'voice-ja': text['voice-ja'].join(''),
    ja: text.ja.join(''),
  };
}

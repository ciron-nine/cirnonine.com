/**
 * PROTOTYPE（首页第十一轮）：只给 ?variant= 选中的那一版启动脚本，切换时先停掉上一版。
 */
import { currentVariant, showCurrentVariant } from '../prototype/variants';
import { mountSpectra } from './spectra';

const MOUNT: Record<string, ((root: HTMLElement) => () => void) | undefined> = {
  A: mountSpectra,
};
let stop: (() => void) | undefined;
let applied: string | undefined;

function apply() {
  if (!document.querySelector('[data-prototype-variants]')) return;
  const key = currentVariant() ?? 'A';
  if (key === applied) return;
  applied = key;
  stop?.();
  stop = undefined;
  showCurrentVariant();
  const root = document.querySelector<HTMLElement>(`[data-variant="${key}"]`);
  const mount = MOUNT[key];
  if (root && mount) stop = mount(root);
  scrollTo(0, 0);
}

document.addEventListener('astro:page-load', () => {
  applied = undefined;
  apply();
});
document.addEventListener('prototype:variant', apply);
document.addEventListener('astro:before-swap', () => {
  stop?.();
  stop = undefined;
  applied = undefined;
});

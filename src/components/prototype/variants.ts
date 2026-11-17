/**
 * PROTOTYPE：同一路由上的几个 UI 变体，用 ?variant= 选择。
 * 页面里放一个 [data-prototype-variants] 容器，子元素各带 data-variant="A" 和 data-variant-name="…"。
 * 生产构建里也认 ?variant=（方便在预览部署上看），只是不显示切换条。
 */

export interface VariantInfo {
  key: string;
  name: string;
}

function container() {
  return document.querySelector<HTMLElement>('[data-prototype-variants]');
}

function panels(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(':scope > [data-variant]')];
}

export function listVariants(): VariantInfo[] {
  const root = container();
  return root ? panels(root).map((el) => ({ key: el.dataset.variant!, name: el.dataset.variantName ?? '' })) : [];
}

export function currentVariant(): string | undefined {
  const keys = listVariants().map((v) => v.key);
  const wanted = new URL(location.href).searchParams.get('variant')?.toUpperCase();
  return wanted && keys.includes(wanted) ? wanted : keys[0];
}

/** 只显示当前变体，其余的藏起来 */
export function showCurrentVariant() {
  const root = container();
  if (!root) return;
  const current = currentVariant();
  for (const panel of panels(root)) panel.hidden = panel.dataset.variant !== current;
  document.dispatchEvent(new CustomEvent('prototype:variant', { detail: current }));
}

/** 换到前一个或后一个变体（首尾相接），写进地址栏，刷新和分享都停在这个变体 */
export function stepVariant(step: 1 | -1) {
  const variants = listVariants();
  if (variants.length === 0) return;
  const index = variants.findIndex((v) => v.key === currentVariant());
  const next = variants[(index + step + variants.length) % variants.length];
  const url = new URL(location.href);
  url.searchParams.set('variant', next.key);
  // 保留 ClientRouter 记在 history.state 里的东西
  history.replaceState(history.state, '', url);
  showCurrentVariant();
  window.scrollTo({ top: 0 });
}

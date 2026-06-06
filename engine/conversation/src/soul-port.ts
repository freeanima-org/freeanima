let loadSoulImpl: (() => string) | null = null;

export function registerLoadSoul(fn: () => string): void {
  loadSoulImpl = fn;
}

export function unregisterLoadSoul(): void {
  loadSoulImpl = null;
}

/** 读取 SOUL 文本；实现由组合根注册（默认空字符串） */
export function loadSoul(): string {
  if (!loadSoulImpl) return "";
  return loadSoulImpl();
}

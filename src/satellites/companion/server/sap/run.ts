/** @deprecated attach 在 overlay；保留空壳以免旧 import 断裂 */
export function connectSap(_habitatUrl: string, _httpUrl?: string): void {
  /* no-op */
}

/** @deprecated use connectSap */
export const runCompanionSap = connectSap;

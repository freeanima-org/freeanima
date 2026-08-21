/**
 * 卧室等「非产品固定 user」场景临时覆盖 portal subject。
 * 影响 getUserSubjectId / getCachedUserSubjectId / useUserSubjectId。
 * 产品 Rail 模块不应设置；离开覆盖树时必须清回 null。
 */

type Listener = () => void;

let overrideId: number | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function getPortalSubjectIdOverride(): number | null {
  return overrideId;
}

export function setPortalSubjectIdOverride(id: number | null): void {
  const next = id != null && Number.isInteger(id) && id > 0 ? id : null;
  if (overrideId === next) return;
  overrideId = next;
  notify();
}

export function subscribePortalSubjectIdOverride(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPortalSubjectIdOverrideForTest(): void {
  overrideId = null;
  notify();
}

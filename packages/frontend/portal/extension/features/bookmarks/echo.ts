/** 短窗回声抑制：刚推到 Habitat 的 browser_id 在 pull 时跳过回写 Chrome */

const ECHO_TTL_MS = 15_000;
const recent = new Map<string, number>();

export function markBookmarkEcho(browserId: string): void {
  recent.set(browserId, Date.now());
}

export function shouldSuppressBookmarkEcho(browserId: string): boolean {
  const at = recent.get(browserId);
  if (at == null) return false;
  if (Date.now() - at > ECHO_TTL_MS) {
    recent.delete(browserId);
    return false;
  }
  return true;
}

export function pruneBookmarkEcho(): void {
  const now = Date.now();
  for (const [id, at] of recent) {
    if (now - at > ECHO_TTL_MS) recent.delete(id);
  }
}

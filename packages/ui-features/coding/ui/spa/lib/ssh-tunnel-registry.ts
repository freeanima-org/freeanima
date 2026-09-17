/**
 * 桌面 SSH 反向隧道句柄（进程内）：会话级绑定，切走/删除/卸载时 stop。
 * handleId 由 portalShell.sshProcess 解释，不可持久化到 localStorage。
 */

async function stopDetached(handleId: string): Promise<void> {
  const api = window.portalShell?.sshProcess;
  if (!api) return;
  try {
    await api.stopDetached(handleId);
  } catch {
    /* 进程可能已退出 */
  }
}

const tunnelsBySessionId = new Map<string, string>();

/** 绑定会话隧道；若同会话已有不同 handle，先停旧的 */
export async function bindSessionSshTunnel(
  sessionId: string,
  handleId: string | null | undefined,
): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const prev = tunnelsBySessionId.get(id);
  const next = handleId?.trim() || "";
  if (prev && prev !== next) {
    await stopDetached(prev);
    tunnelsBySessionId.delete(id);
  }
  if (next) {
    tunnelsBySessionId.set(id, next);
  }
}

export async function releaseSessionSshTunnel(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const handleId = tunnelsBySessionId.get(id);
  if (!handleId) return;
  tunnelsBySessionId.delete(id);
  await stopDetached(handleId);
}

/** 卸载 / 关窗：停掉本进程登记过的全部隧道 */
export async function releaseAllSshTunnels(): Promise<void> {
  const ids = [...tunnelsBySessionId.keys()];
  await Promise.all(ids.map((sessionId) => releaseSessionSshTunnel(sessionId)));
}

/** 测试用 */
export function clearSshTunnelRegistryForTest(): void {
  tunnelsBySessionId.clear();
}

export function peekSshTunnelHandleForTest(sessionId: string): string | undefined {
  return tunnelsBySessionId.get(sessionId);
}

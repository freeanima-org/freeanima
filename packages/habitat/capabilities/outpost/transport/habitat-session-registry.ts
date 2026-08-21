import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

export type HabitatSessionSendEvent = (method: string, payload: unknown) => void;

export type HabitatSessionEntry = {
  sendEvent: HabitatSessionSendEvent;
  auth: RpcRequestAuthContext;
};

export type BroadcastToSubjectOptions = {
  excludeId?: string;
};

/** 已 connect 的 Habitat RPC WebSocket 会话表；按 auth.subject_type  fan-out。 */
export class HabitatSessionRegistry {
  private readonly sessions = new Map<string, HabitatSessionEntry>();

  register(id: string, entry: HabitatSessionEntry): void {
    this.sessions.set(id, entry);
  }

  unregister(id: string): void {
    this.sessions.delete(id);
  }

  get(id: string): HabitatSessionEntry | undefined {
    return this.sessions.get(id);
  }

  size(): number {
    return this.sessions.size;
  }

  /**
   * Fan-out 到匹配会话。
   * - number：按 auth.subject_id
   * - "user"|"agent"：按 auth.subject_type（兼容旧广播）
   */
  broadcastToSubject(
    subjectKey: RpcRequestAuthContext["subject_type"] | number,
    method: string,
    payload: unknown,
    opts?: BroadcastToSubjectOptions,
  ): number {
    let sent = 0;
    for (const [id, entry] of this.sessions) {
      if (opts?.excludeId != null && id === opts.excludeId) continue;
      if (typeof subjectKey === "number") {
        if (entry.auth.subject_id !== subjectKey) continue;
      } else if (entry.auth.subject_type !== subjectKey) {
        continue;
      }
      entry.sendEvent(method, payload);
      sent += 1;
    }
    return sent;
  }
}

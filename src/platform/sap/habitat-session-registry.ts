import type { SapRequestAuthContext } from "@freeanima/shared/sap-contract";

export type HubSessionSendEvent = (method: string, payload: unknown) => void;

export type HubSessionEntry = {
  sendEvent: HubSessionSendEvent;
  auth: SapRequestAuthContext;
};

export type BroadcastToSubjectOptions = {
  excludeId?: string;
};

/** 已 connect 的 Habitat RPC WebSocket 会话表；按 auth.subject_type  fan-out。 */
export class HubSessionRegistry {
  private readonly sessions = new Map<string, HubSessionEntry>();

  register(id: string, entry: HubSessionEntry): void {
    this.sessions.set(id, entry);
  }

  unregister(id: string): void {
    this.sessions.delete(id);
  }

  get(id: string): HubSessionEntry | undefined {
    return this.sessions.get(id);
  }

  size(): number {
    return this.sessions.size;
  }

  broadcastToSubject(
    subjectType: SapRequestAuthContext["subject_type"],
    method: string,
    payload: unknown,
    opts?: BroadcastToSubjectOptions,
  ): number {
    let sent = 0;
    for (const [id, entry] of this.sessions) {
      if (opts?.excludeId != null && id === opts.excludeId) continue;
      if (entry.auth.subject_type !== subjectType) continue;
      entry.sendEvent(method, payload);
      sent += 1;
    }
    return sent;
  }
}

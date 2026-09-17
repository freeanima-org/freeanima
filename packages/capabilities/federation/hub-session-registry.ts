export type SatelliteTrustState = "trusted" | "pending";

export type SatelliteSession = {
  habitat_instance_id: string;
  public_key: string;
  connected_at: Date;
  trust_state: SatelliteTrustState;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

/** Hub 侧：已握手的 Satellite WS 会话 */
export class FederationHubSessionRegistry {
  private readonly sessions = new Map<string, SatelliteSession>();

  register(session: SatelliteSession): void {
    const existing = this.sessions.get(session.habitat_instance_id);
    existing?.close(4000, "replaced");
    this.sessions.set(session.habitat_instance_id, session);
  }

  unregister(habitat_instance_id: string): void {
    this.sessions.delete(habitat_instance_id);
  }

  get(habitat_instance_id: string): SatelliteSession | undefined {
    return this.sessions.get(habitat_instance_id);
  }

  isOnline(habitat_instance_id: string): boolean {
    return this.sessions.has(habitat_instance_id);
  }

  listOnlineIds(): string[] {
    return [...this.sessions.keys()];
  }

  broadcast(data: string, except?: string): void {
    for (const [id, session] of this.sessions) {
      if (except && id === except) continue;
      if (session.trust_state !== "trusted") continue;
      session.send(data);
    }
  }

  closeAll(code = 1001, reason = "hub shutdown"): void {
    for (const session of this.sessions.values()) {
      session.close(code, reason);
    }
    this.sessions.clear();
  }
}

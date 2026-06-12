import type { ACPClient } from "./client.ts";

export type AcpClientFactory = () => Promise<ACPClient>;

export type ClientLease = {
  slotId: number;
  client: ACPClient;
  taskId: string;
};

type PoolSlot = {
  client: ACPClient | null;
  taskId: string | null;
};

/** Per-agent pool of ACP subprocesses for concurrent async tasks */
export class AcpClientPool {
  private readonly slots: PoolSlot[];

  constructor(
    readonly maxConcurrent: number,
    private readonly factory: AcpClientFactory,
  ) {
    this.slots = Array.from({ length: Math.max(1, maxConcurrent) }, () => ({
      client: null,
      taskId: null,
    }));
  }

  get activeCount(): number {
    return this.slots.filter((s) => s.taskId != null).length;
  }

  get hasFreeSlot(): boolean {
    return this.activeCount < this.slots.length;
  }

  async prewarm(): Promise<void> {
    const slot = this.slots[0];
    if (!slot) return;
    if (slot.client?.isConnected && slot.client.isProcessAlive()) return;
    if (slot.client) slot.client.stop();
    slot.client = await this.factory();
  }

  async tryAcquire(taskId: string): Promise<ClientLease | null> {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (slot.taskId) continue;
      if (!slot.client?.isConnected || !slot.client.isProcessAlive()) {
        if (slot.client) slot.client.stop();
        slot.client = await this.factory();
      }
      slot.taskId = taskId;
      return { slotId: i, client: slot.client, taskId };
    }
    return null;
  }

  release(lease: ClientLease): void {
    const slot = this.slots[lease.slotId];
    if (slot && slot.taskId === lease.taskId) {
      slot.taskId = null;
    }
  }

  abortPrompt(lease: ClientLease): void {
    lease.client.abortActivePrompt();
  }

  findLease(taskId: string): ClientLease | undefined {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (slot.taskId === taskId && slot.client) {
        return { slotId: i, client: slot.client, taskId };
      }
    }
    return undefined;
  }

  listClients(): ACPClient[] {
    const out: ACPClient[] = [];
    for (const slot of this.slots) {
      if (slot.client) out.push(slot.client);
    }
    return out;
  }

  isAnyAlive(): boolean {
    return this.slots.some((s) => s.client?.isConnected && s.client.isProcessAlive());
  }

  async stopAll(): Promise<void> {
    for (const slot of this.slots) {
      if (slot.client) {
        slot.client.stop();
        slot.client = null;
      }
      slot.taskId = null;
    }
  }
}

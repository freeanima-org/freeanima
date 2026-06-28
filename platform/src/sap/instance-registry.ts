import {
  assertSapInstanceId,
  generateSapInstanceIdCandidate,
  normalizeAppSlug,
} from "@freeanima/sap-contract";

import type { SapInstanceStorePort } from "@freeanima/core/repos";

export type SapInstanceRecord = {
  instanceId: string;
  appId: string;
  httpUrl: string | null;
  createdAt: string;
};

export type ResolveConnectInstanceInput = {
  appId: string;
  instanceId?: string;
  httpUrl?: string;
};

export type ResolveConnectInstanceResult =
  | { ok: true; instanceId: string; isNew: boolean }
  | { ok: false; error: string };

/**
 * SAP instance registry with optional PG backing.
 * Hub assigns 3-char globally unique ids on omit; client-provided ids are provisioned when unused.
 */
export class SapInstanceRegistry {
  private readonly byInstanceId = new Map<string, SapInstanceRecord>();

  constructor(private readonly store?: SapInstanceStorePort) {}

  hydrate(records: SapInstanceRecord[]): void {
    for (const record of records) {
      this.byInstanceId.set(record.instanceId, record);
    }
  }

  async resolveConnect(input: ResolveConnectInstanceInput): Promise<ResolveConnectInstanceResult> {
    const appId = input.appId.trim();
    if (!appId) return { ok: false, error: "app_id required" };

    if (input.instanceId?.trim()) {
      let norm: string;
      try {
        norm = assertSapInstanceId(input.instanceId);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }

      let record = this.byInstanceId.get(norm);
      if (!record && this.store) {
        const row = await this.store.get(norm);
        if (row) {
          record = {
            instanceId: row.instance_id,
            appId: row.app_id,
            httpUrl: row.http_url,
            createdAt: row.created_at,
          };
          this.byInstanceId.set(norm, record);
        }
      }

      if (!record) {
        record = {
          instanceId: norm,
          appId,
          httpUrl: input.httpUrl?.trim() ?? null,
          createdAt: new Date().toISOString(),
        };
        this.byInstanceId.set(norm, record);
        await this.persist(record);
        return { ok: true, instanceId: norm, isNew: true };
      }
      if (normalizeAppSlug(record.appId) !== normalizeAppSlug(appId)) {
        return { ok: false, error: `instance_id app mismatch: ${norm}` };
      }
      if (input.httpUrl?.trim()) {
        record.httpUrl = input.httpUrl.trim();
        await this.persist(record);
      }
      return { ok: true, instanceId: norm, isNew: false };
    }

    for (let attempt = 0; attempt < 256; attempt++) {
      const candidate = generateSapInstanceIdCandidate();
      if (this.byInstanceId.has(candidate)) continue;
      const record: SapInstanceRecord = {
        instanceId: candidate,
        appId,
        httpUrl: input.httpUrl?.trim() ?? null,
        createdAt: new Date().toISOString(),
      };
      this.byInstanceId.set(candidate, record);
      await this.persist(record);
      return { ok: true, instanceId: candidate, isNew: true };
    }
    return { ok: false, error: "failed to allocate instance_id" };
  }

  get(instanceId: string): SapInstanceRecord | undefined {
    return this.byInstanceId.get(assertSapInstanceId(instanceId));
  }

  list(): SapInstanceRecord[] {
    return [...this.byInstanceId.values()].toSorted((a, b) =>
      a.instanceId.localeCompare(b.instanceId),
    );
  }

  private async persist(record: SapInstanceRecord): Promise<void> {
    if (!this.store) return;
    await this.store.upsert({
      instance_id: record.instanceId,
      app_id: record.appId,
      http_url: record.httpUrl,
      created_at: record.createdAt,
    });
  }
}

import {
  assertRemoteInstanceId,
  generateRemoteInstanceIdCandidate,
  normalizeAppSlug,
} from "@freeanima/shared/rpc-contract";
import { getRemoteToolInstance, upsertRemoteToolInstance } from "@freeanima/core/db/pg/outpost";

export type RemoteInstanceRecord = {
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
 * Habitat assigns 3-char globally unique ids on omit; client-provided ids are provisioned when unused.
 */
export class RemoteInstanceRegistry {
  private readonly byInstanceId = new Map<string, RemoteInstanceRecord>();

  constructor(private readonly persistToPg = false) {}

  hydrate(records: RemoteInstanceRecord[]): void {
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
        norm = assertRemoteInstanceId(input.instanceId);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }

      let record = this.byInstanceId.get(norm);
      if (!record && this.persistToPg) {
        const row = await getRemoteToolInstance(norm);
        if (row) {
          record = {
            instanceId: row.instance_id,
            appId: row.app_id,
            httpUrl: row.http_url,
            createdAt: row.created_at.toISOString(),
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
      const candidate = generateRemoteInstanceIdCandidate();
      if (this.byInstanceId.has(candidate)) continue;
      const record: RemoteInstanceRecord = {
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

  get(instanceId: string): RemoteInstanceRecord | undefined {
    return this.byInstanceId.get(assertRemoteInstanceId(instanceId));
  }

  list(): RemoteInstanceRecord[] {
    return [...this.byInstanceId.values()].toSorted((a, b) =>
      a.instanceId.localeCompare(b.instanceId),
    );
  }

  private async persist(record: RemoteInstanceRecord): Promise<void> {
    if (!this.persistToPg) return;
    await upsertRemoteToolInstance({
      instance_id: record.instanceId,
      app_id: record.appId,
      http_url: record.httpUrl,
      created_at: new Date(record.createdAt),
    });
  }
}

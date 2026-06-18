import {
  assertSapInstanceId,
  generateSapInstanceIdCandidate,
  normalizeAppSlug,
} from "@freeanima/sap-contract";

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
 * In-memory SAP instance registry. Hub assigns 3-char globally unique ids.
 * Production wiring may persist via PG `sap_instances` table.
 */
export class SapInstanceRegistry {
  private readonly byInstanceId = new Map<string, SapInstanceRecord>();

  resolveConnect(input: ResolveConnectInstanceInput): ResolveConnectInstanceResult {
    const appId = input.appId.trim();
    if (!appId) return { ok: false, error: "app_id required" };

    if (input.instanceId?.trim()) {
      let norm: string;
      try {
        norm = assertSapInstanceId(input.instanceId);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const record = this.byInstanceId.get(norm);
      if (!record) {
        return { ok: false, error: `unknown instance_id: ${norm}` };
      }
      if (normalizeAppSlug(record.appId) !== normalizeAppSlug(appId)) {
        return { ok: false, error: `instance_id app mismatch: ${norm}` };
      }
      if (input.httpUrl?.trim()) {
        record.httpUrl = input.httpUrl.trim();
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
}

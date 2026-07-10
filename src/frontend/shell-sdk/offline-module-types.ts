import type { OfflineModuleId, OfflineOutboxOp } from "./offline-outbox.ts";

export type FlushResult = "done" | "stale" | "failed";

export type RpcFlushContext = {
  scope: string;
  signal?: AbortSignal;
};

export type StreamFlushContext = RpcFlushContext & {
  stream: {
    onEvent: (conversationId: string, ev: unknown) => void;
    onDone: (conversationId: string) => void;
    onError: (conversationId: string, message: string) => void;
    llmDebug?: boolean;
  };
  forceTail?: boolean;
};

export type IdMap = ReadonlyMap<number, number>;

export type RpcModuleAdapter = {
  kind: "rpc";
  moduleId: OfflineModuleId;
  ordering: "fifo" | "topological";
  flushOp: (op: OfflineOutboxOp, ctx: RpcFlushContext) => Promise<FlushResult>;
  refreshAll: (scope: string) => Promise<void>;
  compactOutbox?: (ops: OfflineOutboxOp[]) => OfflineOutboxOp[];
  resolvePayloadIds?: (payload: Record<string, unknown>, idMap: IdMap) => Record<string, unknown>;
};

export type StreamModuleAdapter = {
  kind: "stream";
  moduleId: "chat";
  method: "message.send";
  ordering: "fifo";
  groupKey: (op: OfflineOutboxOp) => string;
  breakOnStale: true;
  preflight?: (
    op: OfflineOutboxOp,
    ctx: StreamFlushContext,
  ) => Promise<"proceed" | "stale" | "abort">;
  flushOp: (op: OfflineOutboxOp, ctx: StreamFlushContext) => Promise<FlushResult>;
  persistForceTail?: (opId: string, scope: string) => Promise<void>;
  refreshAll?: (scope: string) => Promise<void>;
};

export type OfflineModuleAdapter = RpcModuleAdapter | StreamModuleAdapter;

export type OfflineModuleCap = {
  offlineWritable: boolean;
  pendingLabelKey?: string;
};

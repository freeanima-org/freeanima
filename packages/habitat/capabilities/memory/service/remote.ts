import type { MemoryService } from "./memory-service.ts";
import type {
  CiteInput,
  CiteResult,
  ListMemoryInput,
  MemoryRecord,
  RecallInput,
  RecallResult,
  ReflectResult,
  RememberInput,
  RetainInput,
  RetainResult,
  SyncTurnInput,
  SyncTurnResult,
  TemporalGetInput,
  TemporalListInput,
  TemporalRecord,
  UpdateMemoryInput,
} from "./types.ts";
import { MemoryMethodNotImplementedError } from "./errors.ts";

export type RemoteMemoryServiceOpts = {
  /** 例如 http://127.0.0.1:2658/rpc/v1/memory */
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
};

async function postJson<T>(opts: RemoteMemoryServiceOpts, path: string, body: unknown): Promise<T> {
  const fetchFn = opts.fetch ?? fetch;
  const res = await fetchFn(`${opts.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...opts.headers,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`remote MemoryService ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * remote MemoryService：同契约 HTTP 客户端（#16102）。
 * 服务端需暴露对应 JSON 路由；未部署时方法会失败。
 */
export function createRemoteMemoryService(opts: RemoteMemoryServiceOpts): MemoryService {
  const call = <T>(path: string, body?: unknown) => postJson<T>(opts, path, body);

  return {
    deployment: "remote",
    syncTurn: (input: SyncTurnInput) => call<SyncTurnResult>("/syncTurn", input),
    retain: (input: RetainInput) => call<RetainResult>("/retain", input),
    recall: (input: RecallInput) => call<RecallResult>("/recall", input),
    search: (input) => call<MemoryRecord[]>("/search", input ?? {}),
    reflect: (input) => call<ReflectResult>("/reflect", input ?? {}),
    remember: (input: RememberInput) => call<MemoryRecord>("/remember", input),
    update: (input: UpdateMemoryInput) => call<MemoryRecord>("/update", input),
    deprecate: (id: number) => call<void>("/deprecate", { id }),
    get: (id: number) => call<MemoryRecord | null>("/get", { id }),
    list: (input: ListMemoryInput = {}) => call<MemoryRecord[]>("/list", input),
    pin: (id: number) => call<void>("/pin", { id }),
    unpin: (id: number) => call<void>("/unpin", { id }),
    cite: (input: CiteInput) => call<CiteResult>("/cite", input),
    listResident: (o) => call<MemoryRecord[]>("/listResident", o ?? {}),
    assembleResidentBlock: (o) => call<string>("/assembleResidentBlock", o ?? {}),
    temporal: {
      list: (input: TemporalListInput = {}) => call<TemporalRecord[]>("/temporal/list", input),
      get: (input: TemporalGetInput) => call<TemporalRecord | null>("/temporal/get", input),
      search: async () => {
        throw new MemoryMethodNotImplementedError("temporal.search", "remote");
      },
      regenerate: (input) => call<TemporalRecord>("/temporal/regenerate", input),
    },
  };
}

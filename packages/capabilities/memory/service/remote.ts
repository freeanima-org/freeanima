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

async function postJson(
  opts: RemoteMemoryServiceOpts,
  path: string,
  body: unknown,
): Promise<unknown> {
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
  return await res.json();
}

/** remote JSON → 具体返回类型（HTTP 契约边界） */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- 契约断言 helper 仅用于返回类型
function asRemote<T>(value: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- remote MemoryService JSON 契约边界
  return value as T;
}

/**
 * remote MemoryService：同契约 HTTP 客户端（#16102）。
 * 服务端需暴露对应 JSON 路由；未部署时方法会失败。
 */
export function createRemoteMemoryService(opts: RemoteMemoryServiceOpts): MemoryService {
  const call = (path: string, body?: unknown) => postJson(opts, path, body);

  return {
    deployment: "remote",
    syncTurn: async (input: SyncTurnInput) =>
      asRemote<SyncTurnResult>(await call("/syncTurn", input)),
    retain: async (input: RetainInput) => asRemote<RetainResult>(await call("/retain", input)),
    recall: async (input: RecallInput) => asRemote<RecallResult>(await call("/recall", input)),
    search: async (input) => asRemote<MemoryRecord[]>(await call("/search", input ?? {})),
    reflect: async (input) => asRemote<ReflectResult>(await call("/reflect", input ?? {})),
    remember: async (input: RememberInput) =>
      asRemote<MemoryRecord>(await call("/remember", input)),
    update: async (input: UpdateMemoryInput) =>
      asRemote<MemoryRecord>(await call("/update", input)),
    deprecate: async (id: number) => {
      await call("/deprecate", { id });
    },
    get: async (id: number) => asRemote<MemoryRecord | null>(await call("/get", { id })),
    list: async (input: ListMemoryInput = {}) =>
      asRemote<MemoryRecord[]>(await call("/list", input)),
    pin: async (id: number) => {
      await call("/pin", { id });
    },
    unpin: async (id: number) => {
      await call("/unpin", { id });
    },
    cite: async (input: CiteInput) => asRemote<CiteResult>(await call("/cite", input)),
    listResident: async (o) => asRemote<MemoryRecord[]>(await call("/listResident", o ?? {})),
    assembleResidentBlock: async (o) =>
      asRemote<string>(await call("/assembleResidentBlock", o ?? {})),
    temporal: {
      list: async (input: TemporalListInput = {}) =>
        asRemote<TemporalRecord[]>(await call("/temporal/list", input)),
      get: async (input: TemporalGetInput) =>
        asRemote<TemporalRecord | null>(await call("/temporal/get", input)),
      search: async () => {
        throw new MemoryMethodNotImplementedError("temporal.search", "remote");
      },
      regenerate: async (input) =>
        asRemote<TemporalRecord>(await call("/temporal/regenerate", input)),
    },
  };
}

import type { RemoteToolsRequestContext } from "../rpc-contract/index.ts";

/** HTTP/WS 适配器统一 dispatch 上下文（原 server/habitat/dispatch.ts 类型）。 */
export type HabitatDispatchContext = RemoteToolsRequestContext & {
  app_id: string;
  instance_id: string;
  /** HTTP REST 适配器注入；WS 无此字段 */
  httpRequest?: Request;
};

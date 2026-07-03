export * from "./types.ts";
export * from "./response-types.ts";

/** Hub method SSOT 已迁至 @freeanima/hub-contract；此处保留类型 re-export 供 Console UI 过渡 */
export type { HubMethod, HubMethodInputs, HubMethodOutputs } from "@freeanima/hub-contract";
export { isHubMethod, getHubMethodDef, METHOD_REGISTRY } from "@freeanima/hub-contract/registry";

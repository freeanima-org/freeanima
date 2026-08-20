export type {
  CapabilityPolicy,
  CapabilityPolicyFragment,
  ResolvedCapabilityPolicy,
} from "./types.ts";
export { expandToolSets } from "./expand.ts";
export { mergePolicyFragments } from "./merge.ts";
export { resolveCapabilityPolicy, type ResolveCapabilityPolicyInput } from "./resolve.ts";
export { checkTool, filterToolNamesByPolicy, runtimeToolPolicyFromResolved } from "./filter.ts";
export { SLEEP_ALLOWED_TOOLS, resolveSleepPolicy } from "./sleep.ts";
export {
  POLICY_RUN_HARD_DENIED_TOOLS,
  materializeToolNames,
  materializeFromFragments,
  resolveSubagentToolPolicy,
} from "./materialize.ts";
/** 数据维 / token 授权：SSOT 在 @freeanima/shared/service-api-auth；此处再导出便于 habitat 内引用 */
export {
  assertDataCapability,
  DataCapabilityError,
  dataCapabilityFragmentSchema,
  expandTokenPreset,
  EXTENSION_TOKEN_COMPONENTS,
  EXTENSION_TOKEN_MODULES,
  filterWorldIdsByDataCapability,
  FULL_TOKEN_AUTHORIZATION,
  isComponentAllowedByData,
  isFullTokenAuthorization,
  isWorldAllowedByData,
  moduleFromRpcMethod,
  openDataCapability,
  parseDataCapabilityFragment,
  parseServiceApiTokenAuthorization,
  serviceApiTokenAuthorizationSchema,
  serviceApiTokenPortalSchema,
  tokenAllowsModule,
  tokenDataCapability,
  type DataCapabilityCheck,
  type DataCapabilityFragment,
  type ServiceApiTokenAuthorization,
  type ServiceApiTokenPortal,
  type TokenAuthorizationPreset,
} from "@freeanima/shared/service-api-auth";

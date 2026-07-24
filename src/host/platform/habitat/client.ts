/**
 * Typed Habitat client — SSOT 已迁至 portal-sdk（UI 不得 import platform）。
 * Host/测试可继续从此 re-export；新 UI 代码请用 `@freeanima/client/portal-sdk/habitat-typed-client`。
 */
export {
  createTypedHabitatClient,
  getTypedHabitatClient,
  getTypedHabitatUiClient,
  resetTypedHabitatClientForTests,
  ensureClientHabitatMethodRegistry,
  resetClientHabitatMethodRegistryForTests,
  FEATURE_METHOD_DEFS,
  type TypedHabitatClient,
  type HabitatMethod,
  type HabitatMethodInputs,
  type HabitatMethodOutputs,
} from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

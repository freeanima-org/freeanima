import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";

const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

export function providersDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, provider] of Object.entries(entries)) {
    out[id] = {
      ...provider,
      backend: String(provider.backend ?? OPENAI_COMPATIBLE_BACKEND_ID),
    };
  }
  return out;
}

/** 载入草稿时就把 UI 展示的默认 backend 写进对象，避免「看起来已配置、保存却没带上」 */
export function readProvidersDraft(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return providersDraftToPatch(draft);
}

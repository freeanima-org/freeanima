/** modelId for Auto model in Cursor ACP */
export const CURSOR_AUTO_MODEL_ID = "default[]";

/** Resolve model alias in config to ACP modelId; cursor adapter defaults to Auto */
export function resolveAcpModelId(raw: string | undefined, adapterId: string): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed) {
    if (trimmed.toLowerCase() === "auto") return CURSOR_AUTO_MODEL_ID;
    return trimmed;
  }
  if (adapterId === "cursor") return CURSOR_AUTO_MODEL_ID;
  return undefined;
}

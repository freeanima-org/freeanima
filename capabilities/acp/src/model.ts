/** Cursor ACP 中 Auto 模型对应的 modelId */
export const CURSOR_AUTO_MODEL_ID = "default[]";

/** 将 config 中的 model 别名解析为 ACP modelId；cursor 适配器缺省为 Auto */
export function resolveAcpModelId(raw: string | undefined, adapterId: string): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed) {
    if (trimmed.toLowerCase() === "auto") return CURSOR_AUTO_MODEL_ID;
    return trimmed;
  }
  if (adapterId === "cursor") return CURSOR_AUTO_MODEL_ID;
  return undefined;
}

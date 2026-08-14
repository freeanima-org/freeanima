/** 将 VRM / VRMA 加载与绑定失败映射为可读中文（避免裸 TypeError 文案） */
export function formatVrmLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("reading 'undefined'") ||
    lower.includes('reading "undefined"') ||
    lower.includes("cannot read propert") ||
    lower.includes("humanoid") ||
    lower.includes("normalizedrestpose") ||
    lower.includes("createvrmanimationclip") ||
    lower.includes("not a vrm")
  ) {
    return "模型格式不完整或无法绑定动作（请检查是否为合法 VRM）";
  }
  if (lower.includes("下载") || lower.includes("http ") || lower.includes("asset")) {
    return raw;
  }
  if (!raw.trim()) {
    return "模型加载失败";
  }
  return raw;
}

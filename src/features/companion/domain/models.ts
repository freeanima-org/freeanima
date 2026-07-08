export const MAX_VRM_BYTES = 80 * 1024 * 1024;

export function sanitizeModelFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "model.vrm";
  const stem = base.replace(/\.vrm$/i, "");
  const safeStem = stem.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const finalStem = safeStem.length > 0 ? safeStem : `model-${Date.now()}`;
  return `${finalStem}.vrm`;
}

export function validateVrmUpload(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".vrm")) {
    return "仅支持 .vrm 文件";
  }
  if (file.size <= 0) {
    return "文件为空";
  }
  if (file.size > MAX_VRM_BYTES) {
    return `文件过大（上限 ${MAX_VRM_BYTES / (1024 * 1024)}MB）`;
  }
  return null;
}

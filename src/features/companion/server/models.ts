import { jsonResponse } from "./http/cors.ts";
import { addModelFromUpload } from "./model-registry.ts";
import { companionModelCachePath } from "../shared/companion-schema.ts";

export const MAX_VRM_BYTES = 80 * 1024 * 1024;

/** 消毒上传文件名，仅保留安全字符并强制 .vrm 扩展名 */
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

export type ModelUploadResult = {
  model_path: string;
  filename: string;
};

export async function saveUploadedModel(file: File): Promise<ModelUploadResult> {
  const model = await addModelFromUpload(file);
  const filename = companionModelCachePath(model.object_file_id).replace(/^\/models\//, "");
  return { model_path: companionModelCachePath(model.object_file_id), filename };
}

export async function handleModelUpload(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "无效的 multipart 表单" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "缺少 file 字段" }, 400);
  }
  const err = validateVrmUpload(file);
  if (err) return jsonResponse({ error: err }, 400);
  try {
    const result = await saveUploadedModel(file);
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

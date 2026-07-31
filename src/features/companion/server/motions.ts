import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { jsonResponse } from "./http/cors.ts";
import { companionMotionsDir } from "./paths.ts";
import { requiredMotionFiles } from "../shared/motion-manifest.ts";
import { importMotionUpload } from "./motion-import.ts";
import { listMotionLibrary } from "./motion-library.ts";
import { publicMotionsDir, resolveMotionFile, resolveMotionsSearchDirs } from "./motion-path.ts";

/** manifest 中引用的 VRMA 文件名（idle + 分区动作） */
export const REQUIRED_MOTION_FILES = requiredMotionFiles();

export { publicMotionsDir, resolveMotionFile, resolveMotionsSearchDirs };

export function motionsReady(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return REQUIRED_MOTION_FILES.every((name) => resolveMotionInDir(dir, name) != null);
}

function resolveMotionInDir(dir: string, name: string): string | null {
  const direct = join(dir, name);
  if (existsSync(direct) && statSync(direct).isFile()) {
    return direct;
  }
  const nested = join(dir, "vrma", name);
  if (existsSync(nested) && statSync(nested).isFile()) {
    return nested;
  }
  return null;
}

export async function ensureDefaultMotions(): Promise<boolean> {
  const destDir = companionMotionsDir();
  if (motionsReady(destDir)) return true;
  return motionsReady(publicMotionsDir());
}

export async function handleMotionUpload(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "无效的 multipart 请求" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "缺少 file 字段" }, 400);
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".vrma")) {
    return jsonResponse({ error: "仅支持 .vrma" }, 400);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await importMotionUpload(file.name, bytes);
    return jsonResponse({ ok: true, library: listMotionLibrary() });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
}

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

const BOOTH_ITEM_URL = "https://booth.pm/ja/items/5512385";

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

/** 从 URL 下载 zip 并导入（可选镜像） */
export async function downloadMotionsFromUrl(
  url: string,
): Promise<{ dir: string; files: string[] }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return importMotionUpload("download.zip", bytes);
}

export async function ensureDefaultMotions(): Promise<boolean> {
  const destDir = companionMotionsDir();
  if (motionsReady(destDir)) return true;
  if (motionsReady(publicMotionsDir())) return true;

  const url = process.env.COMPANION_VRMA_ZIP_URL?.trim();
  if (!url) return false;

  try {
    await downloadMotionsFromUrl(url);
    return motionsReady(destDir);
  } catch (e) {
    console.warn("[companion] VRMA 自动下载失败:", e);
    return false;
  }
}

export function boothMotionPackUrl(): string {
  return BOOTH_ITEM_URL;
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
  if (!lower.endsWith(".zip") && !lower.endsWith(".vrma") && !lower.endsWith(".fbx")) {
    return jsonResponse({ error: "仅支持 .vrma、.fbx 或 .zip" }, 400);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importMotionUpload(file.name, bytes);
    return jsonResponse({ ok: true, ...result, library: listMotionLibrary() });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
}

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { jsonResponse } from "./http/cors.ts";
import { companionMotionsDir } from "./paths.ts";

/** manifest 中引用的 VRMA 文件名 */
export const REQUIRED_MOTION_FILES = [
  "VRMA_01.vrma",
  "VRMA_02.vrma",
  "VRMA_03.vrma",
  "VRMA_06.vrma",
  "VRMA_07.vrma",
] as const;

const BOOTH_ITEM_URL = "https://booth.pm/ja/items/5512385";

export function publicMotionsDir(): string {
  return join(import.meta.dir, "..", "public", "motions");
}

export function motionsReady(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return REQUIRED_MOTION_FILES.every((name) => resolveMotionInDir(dir, name) !== null);
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

/** 用户数据目录 → 开发 public 回退 */
export function resolveMotionsSearchDirs(): string[] {
  const dirs = [companionMotionsDir(), publicMotionsDir()];
  return dirs.filter((dir, index) => dirs.indexOf(dir) === index);
}

export function resolveMotionFile(relativePath: string): string | null {
  const name = basename(relativePath);
  if (!name.endsWith(".vrma")) return null;

  for (const dir of resolveMotionsSearchDirs()) {
    const found = resolveMotionInDir(dir, name);
    if (found) return found;
  }
  return null;
}

function collectVrmaFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const st = statSync(path);
      if (st.isDirectory()) {
        walk(path);
        continue;
      }
      if (entry.toLowerCase().endsWith(".vrma")) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

async function flattenVrmaFromExtracted(extractRoot: string, destDir: string): Promise<void> {
  mkdirSync(destDir, { recursive: true });

  for (const src of collectVrmaFiles(extractRoot)) {
    const name = basename(src);
    const dest = join(destDir, name);
    if (src !== dest) {
      await Bun.write(dest, Bun.file(src));
    }
  }
}

async function removeRedundantVrmaSubdir(destDir: string): Promise<void> {
  const nested = join(destDir, "vrma");
  if (!existsSync(nested)) return;
  const allAtRoot = REQUIRED_MOTION_FILES.every((name) => existsSync(join(destDir, name)));
  if (!allAtRoot) return;
  await removePath(nested);
}

async function extractZipArchive(zipPath: string, extractRoot: string): Promise<void> {
  mkdirSync(extractRoot, { recursive: true });

  if (process.platform === "win32") {
    const ps = `[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`;
    const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", ps], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`解压失败 (powershell): ${err || code}`);
    }
    return;
  }

  const proc = Bun.spawn(["unzip", "-o", zipPath, "-d", extractRoot], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`解压失败 (unzip): ${err || code}`);
  }
}

async function removePath(path: string): Promise<void> {
  if (process.platform === "win32") {
    await Bun.spawn([
      "powershell",
      "-NoProfile",
      "-Command",
      `Remove-Item -LiteralPath '${path.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`,
    ]).exited;
    return;
  }
  await Bun.spawn(["rm", "-rf", path]).exited;
}

/** 将 VRMA_MotionPack.zip 解压到 ~/.anima/companion/motions/ */
export async function importMotionZipFile(
  zipPath: string,
): Promise<{ dir: string; files: string[] }> {
  const destDir = companionMotionsDir();
  const tempDir = join(destDir, ".import-tmp");
  mkdirSync(tempDir, { recursive: true });

  try {
    await extractZipArchive(zipPath, tempDir);
    await flattenVrmaFromExtracted(tempDir, destDir);
    await removeRedundantVrmaSubdir(destDir);
  } finally {
    await removePath(tempDir);
  }

  if (!motionsReady(destDir)) {
    throw new Error(
      `ZIP 中未找到所需 VRMA 文件（需要 ${REQUIRED_MOTION_FILES.join("、")}）。官方包结构为 vrma/VRMA_*.vrma，请确认 zip 完整。`,
    );
  }

  const files = REQUIRED_MOTION_FILES.flatMap((name) => {
    const path = resolveMotionInDir(destDir, name);
    return path ? [name] : [];
  });
  return { dir: destDir, files: [...files] };
}

/** 从 COMPANION_VRMA_ZIP_URL 下载并导入（需自行托管 zip 镜像；BOOTH 官方需登录无法静默拉取） */
export async function downloadMotionsFromUrl(
  url: string,
): Promise<{ dir: string; files: string[] }> {
  const destDir = companionMotionsDir();
  mkdirSync(destDir, { recursive: true });
  const zipPath = join(destDir, ".download-tmp.zip");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status}`);
  }
  await Bun.write(zipPath, res);
  try {
    return await importMotionZipFile(zipPath);
  } finally {
    await removePath(zipPath);
  }
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

export async function handleMotionZipUpload(req: Request): Promise<Response> {
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
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return jsonResponse({ error: "仅支持 .zip（VRMA_MotionPack.zip）" }, 400);
  }

  const tempZip = join(companionMotionsDir(), ".upload-tmp.zip");
  mkdirSync(companionMotionsDir(), { recursive: true });
  await Bun.write(tempZip, file);
  try {
    const result = await importMotionZipFile(tempZip);
    return jsonResponse({ ok: true, ...result });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
  } finally {
    await removePath(tempZip);
  }
}

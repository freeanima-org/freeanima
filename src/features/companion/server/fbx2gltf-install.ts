import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { findFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { fbx2gltfBinaryName, fbx2gltfCacheDir, verifyFbx2gltfBinary } from "./fbx2gltf-shared.ts";

const FBX2GLTF_RELEASE_BASE =
  "https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7";
const INSTALL_TIMEOUT_MS = 180_000;
const LOCK_POLL_MS = 500;

export { fbx2gltfBinaryName, fbx2gltfCacheDir, verifyFbx2gltfBinary } from "./fbx2gltf-shared.ts";

function log(msg: string): void {
  console.log(`[companion] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[companion] ${msg}`);
}

async function acquireInstallLock(cacheDir: string): Promise<() => void> {
  mkdirSync(cacheDir, { recursive: true });
  const lockPath = join(cacheDir, ".lock");
  const deadline = Date.now() + INSTALL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockPath, "wx");
      closeSync(fd);
      return () => {
        try {
          unlinkSync(lockPath);
        } catch {
          /* 忽略 */
        }
      };
    } catch {
      if (findFbx2gltfBinary()) {
        return () => {};
      }
      await Bun.sleep(LOCK_POLL_MS);
    }
  }
  throw new Error("FBX2glTF 安装锁等待超时");
}

async function downloadWithCurl(url: string, destPath: string): Promise<boolean> {
  const curl = Bun.which("curl");
  if (!curl) return false;
  const proc = Bun.spawn([curl, "-L", "-f", "--max-time", "120", "-o", destPath, url], {
    stdout: "ignore",
    stderr: "pipe",
  });
  return (await proc.exited) === 0;
}

async function downloadToTemp(url: string, tmpPath: string): Promise<boolean> {
  const curlOk = await downloadWithCurl(url, tmpPath);
  if (curlOk && verifyFbx2gltfBinary(tmpPath)) {
    return true;
  }
  if (existsSync(tmpPath)) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* 忽略 */
    }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return false;
    const bytes = await res.arrayBuffer();
    writeFileSync(tmpPath, new Uint8Array(bytes));
    return verifyFbx2gltfBinary(tmpPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOSPC") || msg.includes("no space")) {
      warn("磁盘空间不足，无法写入 FBX2glTF");
    }
    return false;
  }
}

async function downloadFbx2gltf(name: string, destPath: string): Promise<boolean> {
  const url = `${FBX2GLTF_RELEASE_BASE}/${name}`;
  const cacheDir = fbx2gltfCacheDir();
  mkdirSync(cacheDir, { recursive: true });
  const tmpPath = join(cacheDir, `${name}.tmp-${process.pid}`);

  log(`正在下载 ${url} …`);
  const ok = await downloadToTemp(url, tmpPath);
  if (!ok) {
    warn(`下载失败: ${url}`);
    try {
      unlinkSync(tmpPath);
    } catch {
      /* 忽略 */
    }
    return false;
  }

  if (process.platform !== "win32") {
    chmodSync(tmpPath, 0o755);
  }
  renameSync(tmpPath, destPath);
  return verifyFbx2gltfBinary(destPath);
}

/** 确保 FBX2glTF 已安装到用户缓存目录；已有则立即返回 true。 */
export async function ensureFbx2gltf(options?: { strict?: boolean }): Promise<boolean> {
  const existing = findFbx2gltfBinary();
  if (existing) return true;

  const binaryName = fbx2gltfBinaryName();
  if (!binaryName) {
    warn(`跳过 FBX2glTF：不支持的平台 ${process.platform}/${process.arch}`);
    return !options?.strict;
  }

  const cacheDir = fbx2gltfCacheDir();
  const destPath = join(cacheDir, binaryName);

  let releaseLock: (() => void) | null = null;
  try {
    releaseLock = await acquireInstallLock(cacheDir);
    if (findFbx2gltfBinary()) return true;

    const ok = await downloadFbx2gltf(binaryName, destPath);
    if (!ok || !findFbx2gltfBinary()) {
      warn(
        "FBX2glTF 自动安装失败；请执行 just misc setup-fbx，或从 GitHub facebookincubator/FBX2glTF v0.9.7 手动下载",
      );
      return false;
    }
    log("FBX2glTF 安装完成");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warn(`FBX2glTF 安装异常：${msg}`);
    return false;
  } finally {
    releaseLock?.();
  }
}

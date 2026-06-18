import { chmodSync, existsSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { findFbx2gltfBinary } from "../server/fbx-converter-kit.ts";

const companionRoot = join(import.meta.dir, "..");
const strict = process.argv.includes("--strict");
const FBX2GLTF_RELEASE_BASE =
  "https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7";

function log(msg: string): void {
  console.log(`[companion] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[companion] ${msg}`);
}

function resolveKitDir(): string | null {
  const rel = join(companionRoot, "node_modules", "fbx2vrma-converter");
  if (!existsSync(rel)) return null;
  try {
    return realpathSync(rel);
  } catch {
    return rel;
  }
}

function fbx2gltfBinaryName(): string | null {
  switch (process.platform) {
    case "win32":
      return "FBX2glTF-windows-x64.exe";
    case "darwin":
      return process.arch === "arm64" ? "FBX2glTF-darwin-arm64" : "FBX2glTF-darwin-x64";
    case "linux":
      return "FBX2glTF-linux-x64";
    default:
      return null;
  }
}

function verifyBinary(path: string): boolean {
  if (!existsSync(path)) return false;
  return statSync(path).size > 1_000_000;
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

async function downloadFbx2gltf(name: string, destPath: string): Promise<boolean> {
  const url = `${FBX2GLTF_RELEASE_BASE}/${name}`;
  log(`正在下载 ${url} …`);

  let wrote = false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (res.ok) {
      await Bun.write(destPath, res);
      wrote = true;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOSPC") || msg.includes("no space")) {
      warn("磁盘空间不足，无法写入 FBX2glTF");
      return false;
    }
  }

  if (!wrote) {
    wrote = await downloadWithCurl(url, destPath);
    if (!wrote) {
      warn(`下载失败: ${url}`);
      return false;
    }
  }

  if (process.platform !== "win32") {
    chmodSync(destPath, 0o755);
  }
  return verifyBinary(destPath);
}

if (findFbx2gltfBinary()) {
  log("FBX2glTF 已就绪");
  process.exit(0);
}

const binaryName = fbx2gltfBinaryName();
if (!binaryName) {
  warn(`跳过 FBX2glTF：不支持的平台 ${process.platform}/${process.arch}`);
  process.exit(0);
}

const kitDir = resolveKitDir();
if (!kitDir) {
  warn("跳过 FBX2glTF：未安装 fbx2vrma-converter");
  process.exit(0);
}

const destPath = join(kitDir, binaryName);
let ok = false;
try {
  ok = await downloadFbx2gltf(binaryName, destPath);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("ENOSPC") || msg.includes("no space")) {
    warn("磁盘空间不足，无法安装 FBX2glTF");
  } else {
    warn(`FBX2glTF 下载异常：${msg}`);
  }
}

if (!ok || !findFbx2gltfBinary()) {
  warn(
    "FBX2glTF 自动安装失败；请在 satellites/companion 执行 bun run setup:fbx，或从 GitHub facebookincubator/FBX2glTF v0.9.7 手动下载",
  );
  process.exit(strict ? 1 : 0);
}

log("FBX2glTF 安装完成");

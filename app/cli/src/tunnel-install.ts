import { PATHS } from "@freeanima/core/config";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const CLOUDFLARED_MIN_VERSION = "2024.1.0";

type PlatformAsset = {
  url: string;
  filename: string;
};

function detectAsset(): PlatformAsset {
  const platform = process.platform;
  const arch = process.arch;
  const base = "https://github.com/cloudflare/cloudflared/releases/latest/download";

  if (platform === "linux") {
    if (arch === "arm64")
      return { url: `${base}/cloudflared-linux-arm64`, filename: "cloudflared" };
    if (arch === "arm") return { url: `${base}/cloudflared-linux-arm`, filename: "cloudflared" };
    return { url: `${base}/cloudflared-linux-amd64`, filename: "cloudflared" };
  }
  if (platform === "darwin") {
    if (arch === "arm64")
      return { url: `${base}/cloudflared-darwin-arm64`, filename: "cloudflared" };
    return { url: `${base}/cloudflared-darwin-amd64`, filename: "cloudflared" };
  }
  if (platform === "win32") {
    return { url: `${base}/cloudflared-windows-amd64.exe`, filename: "cloudflared.exe" };
  }
  throw new Error(`不支持的平台: ${platform}/${arch}`);
}

export function cloudflaredBinPath(): string {
  return PATHS.cloudflaredBin;
}

export function isCloudflaredInstalled(): boolean {
  const bin = cloudflaredBinPath();
  return existsSync(bin);
}

export function cloudflaredVersion(bin = cloudflaredBinPath()): string | null {
  if (!existsSync(bin)) return null;
  const r = spawnSync(bin, ["--version"], { encoding: "utf-8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  const match = out.match(/(\d{4}\.\d+\.\d+)/);
  return match?.[1] ?? (out || null);
}

export type InstallCloudflaredOptions = {
  onProgress?: (message: string) => void;
  force?: boolean;
};

export async function installCloudflared(opts: InstallCloudflaredOptions = {}): Promise<string> {
  const bin = cloudflaredBinPath();
  if (isCloudflaredInstalled() && !opts.force) {
    opts.onProgress?.(`cloudflared 已存在: ${bin} (${cloudflaredVersion() ?? "unknown"})`);
    return bin;
  }

  const asset = detectAsset();
  opts.onProgress?.(`下载 cloudflared: ${asset.url}`);

  mkdirSync(PATHS.binDir, { recursive: true });
  const res = await fetch(asset.url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status} — 手动下载: ${asset.url}`);
  }
  const data = new Uint8Array(await res.arrayBuffer());
  writeFileSync(bin, data);
  if (process.platform !== "win32") {
    chmodSync(bin, 0o755);
  }
  opts.onProgress?.(`已安装: ${bin}`);
  return bin;
}

export function manualDownloadHint(): string {
  const asset = detectAsset();
  return asset.url;
}

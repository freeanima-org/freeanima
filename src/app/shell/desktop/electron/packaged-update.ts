import { closeSync, mkdtempSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { type ChildProcess, spawn, type SpawnOptions } from "node:child_process";

import {
  pipeResponseBodyToFile,
  type DownloadProgressHandler,
} from "@freeanima/core/config/app-update/download";

const PE_MAGIC = [0x4d, 0x5a] as const; // MZ

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

/** 校验已下载的 NSIS 安装包（大小 + PE 头） */
export function verifyDownloadedInstaller(filePath: string, expectedSize?: number): void {
  const stat = statSync(filePath);
  if (expectedSize != null && stat.size !== expectedSize) {
    throw new Error(`安装包大小不符: 期望 ${expectedSize} 字节, 实际 ${stat.size} 字节`);
  }
  const fd = openSync(filePath, "r");
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    if (head[0] !== PE_MAGIC[0] || head[1] !== PE_MAGIC[1]) {
      throw new Error("安装包不是有效的 Windows 可执行文件");
    }
  } finally {
    closeSync(fd);
  }
}

export async function downloadInstallerToFile(
  url: string,
  dest: string,
  opts?: {
    expectedSize?: number;
    onProgress?: DownloadProgressHandler;
    fetchImpl?: typeof fetch;
  },
): Promise<void> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "freeanima-desktop-updater", Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`下载安装包失败 HTTP ${res.status}`);
  }
  const contentLength = res.headers.get("content-length");
  const total = opts?.expectedSize ?? (contentLength != null ? Number(contentLength) : null);
  const resolvedTotal = total != null && Number.isFinite(total) && total >= 0 ? total : null;
  await pipeResponseBodyToFile(res.body as ReadableStream<Uint8Array>, dest, {
    total: resolvedTotal,
    ...(opts?.onProgress ? { onProgress: opts.onProgress } : {}),
  });
}

/** 在 temp 下创建唯一目录并返回 setup.exe 路径 */
export function createInstallerTempPath(tempRoot: string): string {
  const dir = mkdtempSync(join(tempRoot, "freeanima-desktop-update-"));
  return join(dir, "freeanima-desktop-windows-x64-setup.exe");
}

function spawnAndWaitForPid(
  spawnImpl: SpawnLike,
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  timeoutMs: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, options);
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("启动安装程序超时")));
    }, timeoutMs);

    child.on("error", (err) => {
      finish(() => reject(new Error(`无法启动安装程序: ${err.message}`)));
    });

    child.on("spawn", () => {
      const pid = child.pid;
      if (pid == null) {
        finish(() => reject(new Error("无法启动安装程序: 未获得进程 ID")));
        return;
      }
      child.unref();
      finish(() => resolve(pid));
    });
  });
}

const DETACHED_SPAWN_OPTS: SpawnOptions = {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
};

/**
 * 在 Windows 上启动 NSIS 静默安装（/S）。
 * 优先 cmd start 脱离 Electron 进程树；失败时回退直接 spawn。
 * 不在此函数内 quit 应用——由 installer.nsh --quit-for-install 关闭。
 */
export async function launchWindowsNsisInstaller(
  installerPath: string,
  opts?: { spawnImpl?: SpawnLike; timeoutMs?: number },
): Promise<number> {
  const spawnImpl = opts?.spawnImpl ?? spawn;
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const comSpec = process.env.ComSpec ?? "cmd.exe";

  try {
    return await spawnAndWaitForPid(
      spawnImpl,
      comSpec,
      ["/d", "/c", "start", '""', "/min", installerPath, "/S"],
      DETACHED_SPAWN_OPTS,
      timeoutMs,
    );
  } catch {
    return spawnAndWaitForPid(spawnImpl, installerPath, ["/S"], DETACHED_SPAWN_OPTS, timeoutMs);
  }
}

export type ApplyPackagedUpdatePayload = {
  assetUrl: string;
  expectedSize?: number;
};

export function parsePackagedUpdatePayload(payload: unknown): ApplyPackagedUpdatePayload {
  if (typeof payload === "string" && payload.startsWith("https://")) {
    return { assetUrl: payload };
  }
  if (payload && typeof payload === "object" && "assetUrl" in payload) {
    const assetUrl = (payload as { assetUrl: unknown }).assetUrl;
    if (typeof assetUrl !== "string" || !assetUrl.startsWith("https://")) {
      throw new Error("无效的安装包 URL");
    }
    const expectedSize = (payload as { expectedSize?: unknown }).expectedSize;
    if (
      expectedSize != null &&
      (typeof expectedSize !== "number" || !Number.isFinite(expectedSize))
    ) {
      throw new Error("无效的安装包大小");
    }
    return {
      assetUrl,
      ...(typeof expectedSize === "number" ? { expectedSize } : {}),
    };
  }
  throw new Error("无效的安装包 URL");
}

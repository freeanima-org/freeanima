import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listCodingOutposts, type CodingOutpostInstance } from "./outposts-api.ts";

const clientDir = dirname(fileURLToPath(import.meta.url));
const bundledProbeScript = join(clientDir, "../probe/cli.ts");

const ATTACH_POLL_MS = 400;
const ATTACH_TIMEOUT_MS = 30_000;

export type ProbeLaunchSpec = {
  command: string;
  args: string[];
};

/** 解析 anima-probe 启动方式：PATH 上的 bin，或同仓 portal/probe/cli.ts */
export function resolveProbeLaunchSpec(): ProbeLaunchSpec {
  const fromPath = Bun.which("anima-probe");
  if (fromPath) {
    return { command: fromPath, args: [] };
  }
  if (existsSync(bundledProbeScript)) {
    return { command: process.execPath, args: [bundledProbeScript] };
  }
  throw new Error("找不到 anima-probe。请安装 FreeAnima CLI，或在源码树中运行 anima-client。");
}

export function spawnLocalCodingProbe(opts: {
  habitatUrl: string;
  token: string;
  workspaceRoot: string;
}): ChildProcess {
  const { command, args: prefixArgs } = resolveProbeLaunchSpec();
  const workspace = resolve(opts.workspaceRoot);
  const child = spawn(
    command,
    [
      ...prefixArgs,
      "--habitat-url",
      opts.habitatUrl,
      "--token",
      opts.token,
      "--workspace",
      workspace,
    ],
    {
      detached: true,
      stdio: "ignore",
      env: process.env,
    },
  );
  child.unref();
  if (child.pid == null) {
    throw new Error("启动 anima-probe 失败");
  }
  return child;
}

export async function waitForCodingOutpost(
  opts: { habitatUrl: string; token: string },
  timeoutMs = ATTACH_TIMEOUT_MS,
): Promise<CodingOutpostInstance> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await listCodingOutposts(opts);
    const first = list[0];
    if (first) {
      return first;
    }
    await Bun.sleep(ATTACH_POLL_MS);
  }
  throw new Error(`等待 coding 前哨 attach 超时（${Math.round(timeoutMs / 1000)}s）`);
}

export async function ensureLocalCodingProbe(opts: {
  habitatUrl: string;
  token: string;
  workspaceRoot: string;
}): Promise<CodingOutpostInstance> {
  const habitatOpts = { habitatUrl: opts.habitatUrl, token: opts.token };
  const existing = await listCodingOutposts(habitatOpts);
  const existingFirst = existing[0];
  if (existingFirst) {
    return existingFirst;
  }

  const workspace = resolve(opts.workspaceRoot);
  console.error(`[anima-client] 未发现 coding 前哨，正在启动 anima-probe workspace=${workspace}`);
  const child = spawnLocalCodingProbe({
    habitatUrl: opts.habitatUrl,
    token: opts.token,
    workspaceRoot: workspace,
  });

  try {
    const outpost = await waitForCodingOutpost(habitatOpts);
    return outpost;
  } catch (e) {
    if (child.pid != null) {
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {
        /* 进程可能已退出 */
      }
    }
    throw e;
  }
}

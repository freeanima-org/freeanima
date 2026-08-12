#!/usr/bin/env bun
/**
 * 先起源码 Habitat，就绪后再起 Vite Web（多 worktree 友好）。
 * Habitat 启动失败或超时未就绪时不启动 Web。
 * 入口：just dev · 亦可：bun scripts/dev.ts · ./scripts/dev.sh（委托本脚本）
 *
 * 环境变量：
 *   HABITAT_PORT  固定 Habitat 端口（默认随机 ≥10000）
 *   WEB_DEV_PORT  Vite 起始端口（默认 5000；占用则 Vite 自增）
 *   FREEANIMA_URL 由本脚本写入，仅作 Vite /rpc|/mcp proxy 目标
 *   FREEANIMA_HABITAT_READY_TIMEOUT_MS  等 Habitat 就绪超时（默认 900000）
 *   FREEANIMA_HABITAT_WATCH  设为 0 关闭 Habitat 源码监视硬重启（默认开，见 scripts/dev-habitat-watch.ts）
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEV_HABITAT_PORT_MIN,
  pickRandomAvailableTcpPort,
} from "@freeanima/portal/cli/tcp-port-available.ts";
import { waitForHabitatReady } from "@freeanima/portal/cli/wait-habitat-ready.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type Child = ReturnType<typeof Bun.spawn>;

function killTree(proc: Child | undefined): void {
  if (!proc || proc.exitCode !== null) return;
  const pid = proc.pid;
  if (pid == null) return;
  if (process.platform === "win32") {
    Bun.spawnSync(["taskkill", "/pid", String(pid), "/T", "/F"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }
}

function forceKillTree(proc: Child | undefined): void {
  if (!proc || proc.exitCode !== null) return;
  const pid = proc.pid;
  if (pid == null) return;
  if (process.platform === "win32") {
    Bun.spawnSync(["taskkill", "/pid", String(pid), "/T", "/F"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      proc.kill(9);
    } catch {
      /* already exited */
    }
  }
}

function spawnDev(cmd: string[], env: NodeJS.ProcessEnv): Child {
  return Bun.spawn(cmd, {
    cwd: root,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    // Unix：独立进程组，便于 Ctrl+C 时整组杀掉（对齐原 scripts/dev.sh set -m）
    ...(process.platform === "win32" ? {} : { detached: true }),
  });
}

const habitatPortEnv = process.env.HABITAT_PORT?.trim();
const habitatPort =
  habitatPortEnv && Number.parseInt(habitatPortEnv, 10) > 0
    ? Number.parseInt(habitatPortEnv, 10)
    : await pickRandomAvailableTcpPort("127.0.0.1", DEV_HABITAT_PORT_MIN);

const webDevPort = process.env.WEB_DEV_PORT?.trim() || "5000";
const env: NodeJS.ProcessEnv = {
  ...process.env,
  FREEANIMA_URL: `http://127.0.0.1:${habitatPort}`,
  WEB_DEV_PORT: webDevPort,
};

console.log(
  `dev · Habitat ${env.FREEANIMA_URL} · Web from :${webDevPort} (proxy only; browser habitat = page origin)`,
);

let habitat: Child | undefined;
let web: Child | undefined;
let cleaning = false;

async function cleanup(): Promise<void> {
  if (cleaning) return;
  cleaning = true;
  killTree(web);
  killTree(habitat);
  await Promise.allSettled([web?.exited, habitat?.exited]);
  forceKillTree(web);
  forceKillTree(habitat);
}

process.on("SIGINT", () => {
  void cleanup().then(() => process.exit(130));
});
process.on("SIGTERM", () => {
  void cleanup().then(() => process.exit(143));
});

habitat = spawnDev(
  ["bun", "scripts/dev-habitat-watch.ts", "--port", String(habitatPort), "--strict-port"],
  env,
);

console.log("dev · waiting for Habitat ready before starting Web…");

const habitatPid = habitat.pid;
const alive = (): boolean => {
  if (habitat?.exitCode !== null) return false;
  if (habitatPid == null) return false;
  try {
    process.kill(habitatPid, 0);
    return true;
  } catch {
    return false;
  }
};

const ok = await waitForHabitatReady("127.0.0.1", habitatPort, { stillAlive: alive });
if (!ok) {
  if (!alive()) {
    console.error("dev · Habitat 启动失败（进程已退出），不启动 Web");
  } else {
    console.error("dev · Habitat 未在超时内就绪，不启动 Web");
  }
  await cleanup();
  process.exit(1);
}

console.log("dev · Habitat ready · starting Web…");
web = spawnDev(["bun", "scripts/dev-web.ts"], env);

const first = await Promise.race([
  habitat.exited.then((code) => ({ code, which: "habitat" as const })),
  web.exited.then((code) => ({ code, which: "web" as const })),
]);
await cleanup();
process.exit(typeof first.code === "number" ? first.code : 1);

#!/usr/bin/env bun
/**
 * 源码 Habitat 开发监督器：监视 `src/`，debounce 后硬重启子进程。
 *
 *   just dev habitat
 *   just dev / scripts/dev.ts（默认走本入口）
 *
 * 行为：
 * - 短时间连存只触发一轮重启（默认 debounce 800ms）
 * - 子进程非 0 退出后不空转重试；曾就绪过则停等下次源码变更
 * - 首次启动即失败：监督器随子进程退出码退出（便于 `just dev` 快速失败）
 * - FREEANIMA_HABITAT_WATCH=0：不监视，单次前台跑 dev-habitat
 *
 * 环境变量：
 *   FREEANIMA_HABITAT_WATCH       设为 0 关闭监视
 *   FREEANIMA_HABITAT_WATCH_MS    debounce 毫秒（默认 800）
 */
import { existsSync, readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const habitatEntry = join(root, "src/portal/cli/dev-habitat.ts");
const watchRoot = join(root, "src");
const habitatArgs = process.argv.slice(2);

function animaHome(): string {
  return process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
}

const DEBOUNCE_MS = (() => {
  const raw = Number.parseInt(process.env.FREEANIMA_HABITAT_WATCH_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 800;
})();

const GRACEFUL_STOP_MS = 20_000;

type Child = ReturnType<typeof Bun.spawn>;

let child: Child | null = null;
let intentionalStop = false;
let shuttingDown = false;
let readyOnce = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let restartQueued = false;

function watchDisabled(): boolean {
  return process.env.FREEANIMA_HABITAT_WATCH?.trim() === "0";
}

function parsePortArg(args: string[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--port") {
      const next = args[i + 1];
      const n = next ? Number.parseInt(next, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (a?.startsWith("--port=")) {
      const n = Number.parseInt(a.slice("--port=".length), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return null;
}

/** `filename` 相对 watchRoot（`src/`） */
function shouldRestartForPath(filename: string): boolean {
  const n = filename.replaceAll("\\", "/");
  if (n.includes("node_modules/")) return false;
  if (n.includes("/__tests__/") || n.startsWith("__tests__/")) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(n)) return false;
  if (n.endsWith("routeTree.gen.ts")) return false;
  // 纯 Vite / 壳 UI：改这些不应拖 Habitat
  if (n.startsWith("portal/app/web/") || n.startsWith("portal/app/tauri/")) return false;
  if (n.startsWith("ui-kit/")) return false;
  if (n.includes("/ui/") && /\.(tsx|css|scss|module\.css)$/.test(n)) return false;
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(n)) return false;
  return true;
}

function killChild(proc: Child, signal: "SIGTERM" | "SIGKILL"): void {
  const pid = proc.pid;
  if (pid == null || proc.exitCode !== null) return;
  try {
    process.kill(pid, signal);
  } catch {
    try {
      proc.kill(signal === "SIGKILL" ? 9 : undefined);
    } catch {
      /* already exited */
    }
  }
}

async function stopChild(): Promise<void> {
  const proc = child;
  if (!proc || proc.exitCode !== null) {
    child = null;
    return;
  }
  intentionalStop = true;
  killChild(proc, "SIGTERM");
  const result = await Promise.race([
    proc.exited.then((code) => ({ kind: "exited" as const, code })),
    new Promise<{ kind: "timeout" }>((resolve) => {
      setTimeout(() => {
        resolve({ kind: "timeout" });
      }, GRACEFUL_STOP_MS);
    }),
  ]);
  if (result.kind === "timeout" && proc.exitCode === null) {
    console.warn("dev-habitat-watch · graceful stop 超时，SIGKILL");
    killChild(proc, "SIGKILL");
    await proc.exited;
  }
  if (child === proc) child = null;
  intentionalStop = false;
}

function spawnHabitat(): Child {
  return Bun.spawn(["bun", habitatEntry, ...habitatArgs], {
    cwd: root,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

function onChildExit(code: number | null): void {
  if (shuttingDown || intentionalStop) return;
  // 正在 debounce 排队重启时，由 runRestart 负责再起，这里不抢
  if (restartQueued) return;

  const exitCode = typeof code === "number" ? code : 1;
  if (exitCode === 0) {
    console.log("dev-habitat-watch · Habitat 已退出 (0)；等待源码变更后再启动");
    return;
  }
  if (!readyOnce) {
    console.error(`dev-habitat-watch · 首次启动失败 (exit ${exitCode})，监督器退出`);
    process.exit(exitCode);
  }
  console.error(
    `dev-habitat-watch · Habitat 退出 (exit ${exitCode})；等待源码变更后再启动（不空转重试）`,
  );
}

function startChild(): void {
  if (shuttingDown) return;
  if (child && child.exitCode === null) return;
  console.log(
    `dev-habitat-watch · starting · bun ${habitatEntry}${habitatArgs.length > 0 ? ` ${habitatArgs.join(" ")}` : ""}`,
  );
  const proc = spawnHabitat();
  child = proc;
  void proc.exited.then((code) => {
    if (child === proc) child = null;
    onChildExit(code);
  });
}

async function runRestart(reason: string): Promise<void> {
  if (shuttingDown) return;
  restartQueued = false;
  console.log(`dev-habitat-watch · restart · ${reason}`);
  await stopChild();
  if (shuttingDown) return;
  startChild();
}

function scheduleRestart(reason: string): void {
  if (shuttingDown) return;
  restartQueued = true;
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runRestart(reason);
  }, DEBOUNCE_MS);
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  restartQueued = false;
  console.log(`dev-habitat-watch · ${signal} · stopping`);
  await stopChild();
  process.exit(signal === "SIGINT" ? 130 : 143);
}

async function runOnce(): Promise<void> {
  console.log("dev-habitat-watch · FREEANIMA_HABITAT_WATCH=0 · 单次启动（无监视）");
  const proc = spawnHabitat();
  child = proc;
  const onSignal = (signal: string): void => {
    void (async () => {
      shuttingDown = true;
      intentionalStop = true;
      killChild(proc, "SIGTERM");
      const result = await Promise.race([
        proc.exited.then((code) => ({ kind: "exited" as const, code })),
        new Promise<{ kind: "timeout" }>((resolve) => {
          setTimeout(() => {
            resolve({ kind: "timeout" });
          }, GRACEFUL_STOP_MS);
        }),
      ]);
      if (result.kind === "timeout" && proc.exitCode === null) {
        killChild(proc, "SIGKILL");
        await proc.exited;
      }
      process.exit(signal === "SIGINT" ? 130 : 143);
    })();
  };
  process.on("SIGINT", () => {
    onSignal("SIGINT");
  });
  process.on("SIGTERM", () => {
    onSignal("SIGTERM");
  });
  const code = await proc.exited;
  process.exit(typeof code === "number" ? code : 1);
}

let cachedStatusPort: number | null = null;

async function probeReadyHttp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/rpc/v1/health/probe`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

/** 无 --port 时：用本子进程写入的 server.status.json（pid 匹配）判断就绪 */
function probeReadyViaStatusFile(pid: number): boolean {
  const statusPath = join(animaHome(), "server.status.json");
  if (!existsSync(statusPath)) return false;
  try {
    const raw = readFileSync(statusPath, "utf-8");
    const body = JSON.parse(raw) as { pid?: unknown; phase?: unknown; port?: unknown };
    if (body.pid !== pid || body.phase !== "ready") return false;
    if (typeof body.port === "number" && body.port > 0) {
      cachedStatusPort = body.port;
    }
    return true;
  } catch {
    return false;
  }
}

async function isHabitatReady(pid: number, portArg: number | null): Promise<boolean> {
  const port = portArg ?? cachedStatusPort;
  if (port != null && (await probeReadyHttp(port))) return true;
  return probeReadyViaStatusFile(pid);
}

function startReadyProbe(portArg: number | null): void {
  const timer = setInterval(() => {
    if (shuttingDown) {
      clearInterval(timer);
      return;
    }
    const proc = child;
    if (readyOnce || !proc || proc.exitCode !== null || proc.pid == null) return;
    void isHabitatReady(proc.pid, portArg).then((ok) => {
      if (!ok || readyOnce) return;
      readyOnce = true;
      console.log("dev-habitat-watch · Habitat ready（此后启动失败将停等源码变更）");
    });
  }, 1000);
}

function startWatching(): void {
  console.log(
    `dev-habitat-watch · watching ${watchRoot} · debounce ${DEBOUNCE_MS}ms · FREEANIMA_HABITAT_WATCH=0 可关`,
  );
  watch(watchRoot, { recursive: true }, (_event, filename) => {
    if (shuttingDown || filename == null) return;
    if (!shouldRestartForPath(filename)) return;
    scheduleRestart(filename);
  });

  startReadyProbe(parsePortArg(habitatArgs));

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  startChild();
}

if (watchDisabled()) {
  await runOnce();
} else {
  startWatching();
}

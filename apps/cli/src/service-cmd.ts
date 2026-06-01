import { installErrorLogHandlers, logStartupError } from "@freeanima/kernel";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { isServerAlive, readStatusFile } from "@freeanima/server/alive";
import {
  apiGet,
  checkServerAlive,
  ensureWebuiBuilt,
  animaBin,
  LOG_FILE,
  prettyDuration,
  serviceUnitPath,
  serviceUnitDir,
  resolveProbeHost,
  readRecentErrorLogTail,
  writeStatusLine,
} from "./service-common.js";

import { parseBindHosts } from "@freeanima/server/bind-hosts";
import { renderSystemdUnit, systemdUserAvailable, SYSTEMD_UNIT } from "./systemd-unit.js";

export type ServiceArgs = {
  action: string;
  foreground: boolean;
  host: string;
  port: number;
};


function systemdFailed(): boolean {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return false;
  const r = systemctl("is-failed", SYSTEMD_UNIT);
  return String(r.stdout ?? "").trim() === "failed";
}

function printStartupErrorHints(): void {
  const lines = readRecentErrorLogTail(12);
  const startupLines = lines.filter((l) => l.includes("[startup]") || l.includes("uncaughtException") || l.includes("unhandledRejection"));
  if (startupLines.length) {
    writeStatusLine("warning", "最近启动错误（error.log）:");
    for (const line of startupLines.slice(-4)) console.log(`    ${line}`);
  } else if (lines.length) {
    writeStatusLine("warning", "最近 error.log:");
    for (const line of lines.slice(-3)) console.log(`    ${line}`);
  }
}

const SYSTEMD_STARTING = new Set(["activating", "auto-restart", "reloading"]);

function systemctl(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
}

export function ensureUnitFile(host: string, port: number): boolean {
  const content = renderSystemdUnit(animaBin(), host, port);
  const dir = serviceUnitDir();
  const unitPath = serviceUnitPath();
  mkdirSync(dir, { recursive: true });
  if (existsSync(unitPath) && readFileSync(unitPath, "utf-8") === content) {
    return false;
  }
  writeFileSync(unitPath, content, "utf-8");
  return true;
}

function systemdState(): string | null {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return null;
  const r = systemctl("is-active", SYSTEMD_UNIT);
  return String(r.stdout ?? "").trim() || null;
}

function hostPort(
  statusFile: Record<string, unknown>,
  args: ServiceArgs,
): [string, number] {
  return [
    String(statusFile.host ?? args.host),
    Number(statusFile.port ?? args.port),
  ];
}

async function fetchHttpStatus(
  host: string,
  port: number,
): Promise<[boolean, Record<string, unknown> | null, number]> {
  const probeHost = resolveProbeHost(host);
  const t0 = performance.now();
  const health = await apiGet(probeHost, port, "/api/health", 2000);
  const ms = performance.now() - t0;
  if (!health || health.status !== "ok") return [false, null, ms];
  const body = await apiGet(probeHost, port, "/api/status", 3000);
  if (body && "error" in body) return [true, null, ms];
  return [true, body, ms];
}

function printWebui(host: string, port: number): void {
  console.log("  WebUI:");
  for (const h of parseBindHosts(host)) {
    const base = `http://${h}:${port}/webui`;
    console.log(`    ${base}/`);
    console.log(`    会客厅: ${base}/parlor/chat`);
    console.log(`    卧室: ${base}/chamber/dashboard`);
    console.log(`    创作室: ${base}/studio/pair-programming`);
  }
}

function printRunning(
  body: Record<string, unknown> | null,
  statusFile: Record<string, unknown>,
  host: string,
  port: number,
): void {
  const api = body ?? {};
  const pid = api.pid ?? statusFile.pid ?? isServerAlive() ?? "?";
  const version = api.version ?? statusFile.version ?? "?";

  let uptime = api.uptime_seconds as number | undefined;
  if (uptime == null && statusFile.start_time) {
    uptime = Date.now() / 1000 - Number(statusFile.start_time);
  }
  const uptimeS = uptime != null ? prettyDuration(uptime) : "";

  const headline = [`PID ${pid}`, uptimeS ? `运行 ${uptimeS}` : "", `版本 ${version}`]
    .filter(Boolean)
    .join("    ");
  console.log(`逸灵风 · 运行中`);
  console.log(`  ${headline}`);
  const addrs = parseBindHosts(host).map((h) => `http://${h}:${port}`).join("  ");
  console.log(`  地址: ${addrs}`);

  const config = (api.config as Record<string, unknown>) ?? {};
  const model = config.model ?? statusFile.model;
  const apiBase = config.api_base ?? statusFile.api_base;
  if (model) writeStatusLine("info", `模型: ${model}`);
  if (apiBase) writeStatusLine("info", `API: ${apiBase}`);

  const platforms = (api.platforms as Record<string, Record<string, unknown>>) ?? {};
  const names = Object.keys(platforms);
  if (names.length) {
    console.log(`  平台 (${names.length}):`);
    for (const name of names) {
      const ps = platforms[name] ?? {};
      const status = String(ps.status ?? "unknown");
      let line = `    ${name}: [${status}]`;
      if (ps.bot_name) line += ` (${ps.bot_name})`;
      console.log(line);
    }
  }

  const sessions = api.sessions as Record<string, unknown> | undefined;
  if (sessions && "total" in sessions) {
    writeStatusLine("info", `会话: ${sessions.total} 个`);
  }

  const tools = api.tools;
  if (tools) writeStatusLine("info", `工具: ${tools} 个`);

  const memKb = api.memory_kb;
  if (memKb) writeStatusLine("info", `内存: ${Number(memKb) / 1024} MB (RSS)`);
}

function printDeadStatus(statusFile: Record<string, unknown>): void {
  const startTime = statusFile.start_time_iso ?? "";
  const version = statusFile.version ?? "?";
  const startTs = Number(statusFile.start_time ?? 0);
  const phase = String(statusFile.phase ?? "");
  let ranFor = "";
  if (startTs > 0) {
    const now = Date.now() / 1000;
    if (startTs < now) ranFor = ` (曾运行 ${prettyDuration(now - startTs)})`;
  }
  console.log("逸灵风 · 未运行");
  if (startTs > 0) {
    const when = startTime || new Date(startTs * 1000).toISOString();
    console.log(`  最后启动: ${when}${ranFor}`);
  }
  console.log(`  版本: ${version}`);
  if (phase === "starting") writeStatusLine("warning", "启动未完成即退出");
  else writeStatusLine("warning", "可能异常退出");
  console.log(`  日志: ${LOG_FILE}`);
  printStartupErrorHints();
}

async function cmdServiceStatus(args: ServiceArgs): Promise<void> {
  const statusFile = readStatusFile() ?? {};
  const [host, port] = hostPort(statusFile, args);
  const sd = systemdState();

  if (sd) writeStatusLine("info", `systemd: ${sd}`);

  const [httpUp, body, healthMs] = await fetchHttpStatus(host, port);
  const pid = isServerAlive();

  if (httpUp) {
    printRunning(body, statusFile, host, port);
    writeStatusLine("ok", `health 在线 — ${healthMs.toFixed(0)}ms`);
    printWebui(host, port);
    return;
  }

  if (pid != null) {
    const startTs = Number(statusFile.start_time ?? 0);
    const startingFor = startTs > 0 ? Date.now() / 1000 - startTs : 0;
    console.log(`逸灵风 · 启动中 (PID ${pid})`);
    if (startingFor > 120) {
      writeStatusLine("warning", `HTTP 未就绪已 ${prettyDuration(startingFor)}，可能卡在启动阶段`);
      writeStatusLine("info", "建议: anima service stop && anima service start --foreground");
    } else {
      writeStatusLine("warning", "HTTP 未就绪，可能正在启动或端口未监听");
    }
    if (sd && SYSTEMD_STARTING.has(sd)) writeStatusLine("info", `systemd: ${sd}`);
    printStartupErrorHints();
    return;
  }

  if (sd && SYSTEMD_STARTING.has(sd)) {
    console.log("逸灵风 · 启动中…");
    if (sd) writeStatusLine("info", `systemd: ${sd}`);
    return;
  }

  if (systemdFailed()) {
    console.log("逸灵风 · 未运行");
    writeStatusLine("warning", "systemd 报告 anima.service 启动失败");
    writeStatusLine("info", "查看: journalctl --user -u anima -n 30 --no-pager");
    console.log(`  日志: ${LOG_FILE}`);
    printStartupErrorHints();
    return;
  }

  if (statusFile.start_time) {
    printDeadStatus(statusFile);
    return;
  }

  console.log("逸灵风 · 未运行");
  printStartupErrorHints();
  console.log("  启动: anima service start");
  console.log("  调试: anima service start --foreground");
}

export async function runServiceCommand(args: ServiceArgs): Promise<void> {
  const action = args.action || "start";

  if (action === "start") {
    if (args.foreground) {
      if (isServerAlive()) {
        console.log(`逸灵风已在运行 (PID ${isServerAlive()})`);
        process.exit(1);
      }
      ensureWebuiBuilt();
      console.log("逸灵风 · 前台启动…");
      installErrorLogHandlers();
      try {
        console.log("[startup] 加载服务模块…");
        const t0 = performance.now();
        const { serve } = await import("@freeanima/server");
        console.log(`[startup] 模块就绪 (${(performance.now() - t0).toFixed(0)}ms)`);
        await serve(args.host, args.port);
      } catch (e) {
        logStartupError("服务启动失败", e);
        process.exit(1);
      }
      return;
    }

    if (!systemdUserAvailable()) {
      console.error("错误: 未检测到 systemd --user。");
      console.error("  日常启动请配置 systemd user session。");
      console.error("  本地调试请用: anima service start --foreground");
      process.exit(1);
    }

    ensureWebuiBuilt();
    ensureUnitFile(args.host, args.port);
    systemctl("daemon-reload");
    const r = systemctl("enable", "--now", SYSTEMD_UNIT);
    if (r.status !== 0) {
      console.error(`启动失败: ${r.stderr || r.stdout}`);
      process.exit(1);
    }
    writeStatusLine("ok", "已通过 systemd 启动");
    console.log(`  unit: ${serviceUnitPath()}`);
    console.log(`  地址: http://${args.host}:${args.port}`);
    console.log("  查看: anima service status");
    return;
  }

  if (action === "stop") {
    if (systemdUserAvailable() && existsSync(serviceUnitPath())) {
      const r = systemctl("stop", SYSTEMD_UNIT);
      if (r.status === 0) {
        console.log("逸灵风已停止 (systemd)");
        return;
      }
    }
    const pid = checkServerAlive();
    if (pid == null) {
      console.log("逸灵风未运行");
      return;
    }
    process.kill(pid, "SIGTERM");
    for (let i = 0; i < 10; i++) {
      await new Promise((res) => setTimeout(res, 300));
      if (checkServerAlive() == null) {
        console.log(`逸灵风 (PID ${pid}) 已停止`);
        return;
      }
    }
    console.log(`逸灵风 (PID ${pid}) 已发送 SIGTERM，等待超时`);
    return;
  }

  if (action === "restart") {
    if (systemdUserAvailable() && existsSync(serviceUnitPath())) {
      ensureUnitFile(args.host, args.port);
      systemctl("daemon-reload");
      const r = systemctl("restart", SYSTEMD_UNIT);
      if (r.status === 0) {
        writeStatusLine("ok", "已重启 (systemd)");
        return;
      }
    }
    await runServiceCommand({ ...args, action: "stop" });
    await runServiceCommand({ ...args, action: "start", foreground: false });
    return;
  }

  if (action === "status") {
    await cmdServiceStatus(args);
    return;
  }

  console.error(`未知操作: ${action}`);
  process.exit(1);
}

/** 供测试：探测服务是否 HTTP 可达 */
export async function probeService(
  host: string,
  port: number,
): Promise<"up" | "pid_only" | "down"> {
  const [httpUp] = await fetchHttpStatus(host, port);
  if (httpUp) return "up";
  if (isServerAlive() != null) return "pid_only";
  return "down";
}

import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { readFileSync, existsSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { renderSystemdUnit } from "./systemd-unit.ts";
import { ensureUnitFile } from "./service-cmd.ts";
import * as serviceCommon from "./service-common.ts";
import {
  parseBindHosts,
  resolveProbeHost,
  DEFAULT_BIND_HOST,
} from "@freeanima/platform/bind-hosts";

describe("bind hosts", () => {
  it("parseBindHosts splits comma-separated addresses", () => {
    expect(parseBindHosts("127.0.0.1,0.0.0.0")).toEqual(["127.0.0.1", "0.0.0.0"]);
    expect(resolveProbeHost("127.0.0.1,0.0.0.0")).toBe("127.0.0.1");
    expect(resolveProbeHost("0.0.0.0")).toBe("127.0.0.1");
    expect(DEFAULT_BIND_HOST).toBe("127.0.0.1");
  });
});

describe("systemd unit", () => {
  const prevXdg = process.env.XDG_CONFIG_HOME;
  let configHome: string;

  beforeEach(() => {
    configHome = createTempDir("freeanima-systemd-");
    process.env.XDG_CONFIG_HOME = join(configHome, ".config");
    mkdirSync(join(process.env.XDG_CONFIG_HOME, "systemd", "user"), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
    removeTempDir(configHome);
  });

  it("ExecStart uses foreground and host/port", () => {
    const unit = renderSystemdUnit("/usr/bin/anima", "127.0.0.1", 8080, "/opt/freeanima");
    expect(unit).toContain("ExecStart=/usr/bin/anima service start --foreground");
    expect(unit).toContain("--host 127.0.0.1");
    expect(unit).toContain("--port 8080");
    expect(unit).toContain("WorkingDirectory=/opt/freeanima");
    expect(unit).toContain("Environment=FREEANIMA_REPO_ROOT=/opt/freeanima");
  });

  it("default host binds loopback", () => {
    const unit = renderSystemdUnit("/usr/bin/anima");
    expect(unit).toContain("--host 127.0.0.1");
  });

  it("unit has restart policy", () => {
    const unit = renderSystemdUnit("/bin/anima");
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("RestartSec=180");
    expect(unit).toContain("StartLimitIntervalSec=0");
    expect(unit).toContain("WantedBy=default.target");
  });

  it("unit allows time for graceful shutdown", () => {
    const unit = renderSystemdUnit("/bin/anima");
    expect(unit).toContain("TimeoutStopSec=120");
  });

  it("ensureUnitFile writes and skips unchanged", () => {
    vi.spyOn(serviceCommon, "animaBin").mockReturnValue("/opt/anima");
    expect(ensureUnitFile("127.0.0.1", 9090)).toBe(true);
    const path = serviceCommon.serviceUnitPath();
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("--port 9090");
    expect(ensureUnitFile("127.0.0.1", 9090)).toBe(false);
  });

  it("animaBin prefers current TS cli.ts over PATH", () => {
    vi.restoreAllMocks();
    const dir = createTempDir("freeanima-cli-");
    const cliPath = join(dir, "cli.ts");
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    const prev = process.argv[1];
    process.argv[1] = cliPath;
    try {
      const bin = serviceCommon.animaBin();
      expect(bin).toBe(`${process.execPath} ${realpathSync(cliPath)}`);
      expect(bin).not.toContain(".venv");
    } finally {
      process.argv[1] = prev;
      removeTempDir(dir);
    }
  });
  it("resolveAnimaSpawn splits execPath + script from animaBin", () => {
    vi.spyOn(serviceCommon, "animaBin").mockReturnValue("/usr/bin/bun /opt/anima/cli.js");
    expect(serviceCommon.resolveAnimaSpawn(["service", "start"])).toEqual({
      command: "/usr/bin/bun",
      args: ["/opt/anima/cli.js", "service", "start"],
    });
    vi.restoreAllMocks();
  });

  it("resolveAnimaSpawn passes through single-path bin", () => {
    vi.spyOn(serviceCommon, "animaBin").mockReturnValue("/home/user/.bun/bin/anima");
    expect(serviceCommon.resolveAnimaSpawn(["status"])).toEqual({
      command: "/home/user/.bun/bin/anima",
      args: ["status"],
    });
    vi.restoreAllMocks();
  });
});

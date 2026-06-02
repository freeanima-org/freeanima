import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderSystemdUnit } from "../../src/systemd-unit.js";
import { ensureUnitFile } from "../../src/service-cmd.js";
import * as serviceCommon from "../../src/service-common.js";
import { parseBindHosts, resolveProbeHost, DEFAULT_BIND_HOST } from "@freeanima/legacy-server/bind-hosts";

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

  beforeEach(() => {
    const configHome = mkdtempSync(join(tmpdir(), "freeanima-systemd-"));
    process.env.XDG_CONFIG_HOME = join(configHome, ".config");
    mkdirSync(join(process.env.XDG_CONFIG_HOME, "systemd", "user"), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prevXdg;
  });

  it("ExecStart uses foreground and host/port", () => {
    const unit = renderSystemdUnit("/usr/bin/anima", "127.0.0.1", 8080);
    expect(unit).toContain("ExecStart=/usr/bin/anima service start --foreground");
    expect(unit).toContain("--host 127.0.0.1");
    expect(unit).toContain("--port 8080");
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

  it("animaBin prefers current TS cli.js over PATH", () => {
    vi.restoreAllMocks();
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-"));
    const cliPath = join(dir, "cli.js");
    writeFileSync(cliPath, "#!/usr/bin/env node\n");
    const prev = process.argv[1];
    process.argv[1] = cliPath;
    try {
      const bin = serviceCommon.animaBin();
      expect(bin).toBe(`${process.execPath} ${realpathSync(cliPath)}`);
      expect(bin).not.toContain(".venv");
    } finally {
      process.argv[1] = prev;
    }
  });
});

// Bun 暂不支持 vi.doMock / resetModules 动态 mock 模块
describe.skipIf(typeof Bun !== "undefined")("service start without systemd", () => {
  it("exits when systemd unavailable", async () => {
    vi.resetModules();
    vi.doMock("../../src/systemd-unit.js", () => ({
      SERVICE_UNIT_NAME: "anima.service",
      renderSystemdUnit,
      systemdUserAvailable: () => false,
    }));

    const { runServiceCommand } = await import("../../src/service-cmd.js");

    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as (code?: number) => never);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runServiceCommand({
        action: "start",
        foreground: false,
        host: "127.0.0.1",
        port: 8080,
      }),
    ).rejects.toThrow("exit");

    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.some((c) => String(c[0]).includes("--foreground"))).toBe(true);

    vi.resetModules();
    vi.doUnmock("../apps/cli/src/systemd-unit.js");
  });
});

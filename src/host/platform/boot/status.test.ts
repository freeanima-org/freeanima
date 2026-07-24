import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

describe("status pid ownership", () => {
  const prevHome = process.env.FREEANIMA_HOME;
  let home: string;

  beforeEach(() => {
    home = join(tmpdir(), `anima-status-test-${process.pid}-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("claimPidFileIfUnowned does not clobber a live foreign pid", async () => {
    const { PATHS } = await import("@freeanima/host/platform/config");
    const { claimPidFileIfUnowned, cleanStatusFile, writeStatusFile } = await import("./status.ts");

    const holder = spawn("sleep", ["30"], { stdio: "ignore" });
    const foreignPid = holder.pid;
    if (foreignPid == null) throw new Error("failed to spawn holder");

    try {
      writeFileSync(PATHS.pidFile, String(foreignPid));
      writeFileSync(
        PATHS.statusFile,
        JSON.stringify({ pid: foreignPid, host: "127.0.0.1", port: 2658, phase: "ready" }),
      );

      expect(claimPidFileIfUnowned()).toBe(false);
      expect(readFileSync(PATHS.pidFile, "utf-8").trim()).toBe(String(foreignPid));

      writeStatusFile("127.0.0.1", 2701, "ready");
      const status = JSON.parse(readFileSync(PATHS.statusFile, "utf-8")) as {
        pid: number;
        port: number;
      };
      expect(status.pid).toBe(foreignPid);
      expect(status.port).toBe(2658);

      cleanStatusFile();
      expect(existsSync(PATHS.pidFile)).toBe(true);
      expect(existsSync(PATHS.statusFile)).toBe(true);
    } finally {
      holder.kill("SIGKILL");
      await new Promise<void>((resolve) => {
        holder.once("exit", () => {
          resolve();
        });
      });
    }

    writeFileSync(PATHS.pidFile, String(process.pid));
    writeFileSync(
      PATHS.statusFile,
      JSON.stringify({ pid: process.pid, host: "127.0.0.1", port: 2701, phase: "ready" }),
    );
    expect(claimPidFileIfUnowned()).toBe(true);
    cleanStatusFile();
    expect(existsSync(PATHS.pidFile)).toBe(false);
    expect(existsSync(PATHS.statusFile)).toBe(false);

    try {
      unlinkSync(PATHS.pidFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(PATHS.statusFile);
    } catch {
      /* ignore */
    }
  });
});

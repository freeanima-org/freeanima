import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as childProcess from "node:child_process";

import { EngineRunControl } from "./engine-run-control.ts";
import * as processRestart from "./process-restart.ts";

describe("process-restart", () => {
  const prevInvocation = process.env.INVOCATION_ID;

  beforeEach(() => {
    delete process.env.INVOCATION_ID;
  });

  afterEach(() => {
    if (prevInvocation === undefined) delete process.env.INVOCATION_ID;
    else process.env.INVOCATION_ID = prevInvocation;
  });

  it("isSystemdManaged 检测 INVOCATION_ID", () => {
    expect(processRestart.isSystemdManaged()).toBe(false);
    process.env.INVOCATION_ID = "abc";
    expect(processRestart.isSystemdManaged()).toBe(true);
  });

  it("systemd 托管时调用 systemctl restart", async () => {
    process.env.INVOCATION_ID = "run-1";
    const unref = mock(() => {});
    const spawnSpy = spyOn(childProcess, "spawn").mockReturnValue({
      unref,
    } as never);

    try {
      await processRestart.triggerServiceRestart();

      expect(spawnSpy).toHaveBeenCalledWith(
        "systemctl",
        ["--user", "restart", processRestart.SYSTEMD_UNIT],
        expect.objectContaining({ detached: true, stdio: "ignore" }),
      );
      expect(unref).toHaveBeenCalled();
    } finally {
      spawnSpy.mockRestore();
    }
  });

  it("非 systemd 时发送 SIGTERM", async () => {
    const killSpy = spyOn(process, "kill").mockImplementation(() => true);

    try {
      await processRestart.triggerServiceRestart();

      expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
    } finally {
      killSpy.mockRestore();
    }
  });

  it("scheduleGracefulRestart 同步 startShutdown 与 abortAll", async () => {
    const killSpy = spyOn(process, "kill").mockImplementation(() => true);
    const ctrl = new EngineRunControl();
    const startSpy = spyOn(ctrl, "startShutdown");
    const abortSpy = spyOn(ctrl, "abortAll");

    try {
      processRestart.scheduleGracefulRestart(ctrl);
      expect(startSpy).toHaveBeenCalled();
      expect(abortSpy).toHaveBeenCalled();
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      killSpy.mockRestore();
      startSpy.mockRestore();
      abortSpy.mockRestore();
    }
  });
});

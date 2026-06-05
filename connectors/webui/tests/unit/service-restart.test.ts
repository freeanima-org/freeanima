import { describe, it, expect, mock, beforeEach, afterEach, spyOn, vi } from "bun:test";
import * as childProcess from "node:child_process";

import {
  isSystemdManaged,
  triggerServiceRestart,
  scheduleServiceRestart,
} from "../../src/service-restart.ts";

describe("service-restart", () => {
  const prevInvocation = process.env.INVOCATION_ID;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    delete process.env.INVOCATION_ID;
  });

  afterEach(() => {
    if (prevInvocation === undefined) delete process.env.INVOCATION_ID;
    else process.env.INVOCATION_ID = prevInvocation;
  });

  it("isSystemdManaged 检测 INVOCATION_ID", () => {
    expect(isSystemdManaged()).toBe(false);
    process.env.INVOCATION_ID = "abc";
    expect(isSystemdManaged()).toBe(true);
  });

  it("systemd 托管时调用 systemctl restart", async () => {
    process.env.INVOCATION_ID = "run-1";
    const unref = mock(() => {});
    const spawnSpy = spyOn(childProcess, "spawn").mockReturnValue({
      unref,
    } as never);

    try {
      await triggerServiceRestart();

      expect(spawnSpy).toHaveBeenCalledWith(
        "systemctl",
        ["--user", "restart", "anima"],
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
      await triggerServiceRestart();

      expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
    } finally {
      killSpy.mockRestore();
    }
  });

  it("scheduleServiceRestart 延迟触发", async () => {
    vi.useFakeTimers();
    const killSpy = spyOn(process, "kill").mockImplementation(() => true);

    try {
      scheduleServiceRestart(100);
      expect(killSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
    } finally {
      killSpy.mockRestore();
    }
  });
});

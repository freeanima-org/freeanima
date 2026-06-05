import { describe, it, expect, mock, beforeEach, afterEach, spyOn, vi } from "bun:test";

const spawnMock = mock(() => ({ unref: mock(() => {}) }));

mock.module("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  isSystemdManaged,
  triggerServiceRestart,
  scheduleServiceRestart,
} from "../../src/service-restart.ts";

describe("service-restart", () => {
  const prevInvocation = process.env.INVOCATION_ID;

  beforeEach(() => {
    spawnMock.mockClear();
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
    spawnMock.mockImplementation(() => ({ unref }));

    await triggerServiceRestart();

    expect(spawnMock).toHaveBeenCalledWith(
      "systemctl",
      ["--user", "restart", "anima"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(unref).toHaveBeenCalled();
  });

  it("非 systemd 时发送 SIGTERM", async () => {
    const killSpy = spyOn(process, "kill").mockImplementation(() => true);

    await triggerServiceRestart();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
    killSpy.mockRestore();
  });

  it("scheduleServiceRestart 延迟触发", async () => {
    vi.useFakeTimers();
    const killSpy = spyOn(process, "kill").mockImplementation(() => true);

    scheduleServiceRestart(100);
    expect(killSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");

    killSpy.mockRestore();
    vi.useRealTimers();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isSystemdManaged,
  triggerServiceRestart,
  scheduleServiceRestart,
} from "../../src/service-restart.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

describe("service-restart", () => {
  const prevInvocation = process.env.INVOCATION_ID;

  beforeEach(() => {
    vi.clearAllMocks();
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
    const unref = vi.fn();
    vi.mocked(spawn).mockReturnValue({ unref } as never);

    await triggerServiceRestart();

    expect(spawn).toHaveBeenCalledWith(
      "systemctl",
      ["--user", "restart", "anima"],
      expect.objectContaining({ detached: true, stdio: "ignore" }),
    );
    expect(unref).toHaveBeenCalled();
  });

  it("非 systemd 时发送 SIGTERM", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    await triggerServiceRestart();

    expect(spawn).not.toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
    killSpy.mockRestore();
  });

  it("scheduleServiceRestart 延迟触发", async () => {
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    scheduleServiceRestart(100);
    expect(killSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");

    killSpy.mockRestore();
    vi.useRealTimers();
  });
});

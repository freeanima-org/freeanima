import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { DISCORD_LOGIN_RETRY_MS } from "../../src/discord/discord-adapter.ts";

describe("discord login retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("重试间隔为 5 分钟", () => {
    expect(DISCORD_LOGIN_RETRY_MS).toBe(5 * 60 * 1000);
  });

  it("scheduleLoginRetry 在间隔后触发回调", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;

    timer = setTimeout(() => {
      timer = null;
      fn();
    }, DISCORD_LOGIN_RETRY_MS);

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DISCORD_LOGIN_RETRY_MS - 1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);

    if (timer !== null) clearTimeout(timer);
  });
});

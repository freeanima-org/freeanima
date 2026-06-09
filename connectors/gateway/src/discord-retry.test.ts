import { describe, expect, it, vi } from "bun:test";
import {
  deliverDiscordFinalContent,
  discordErrorDetails,
  isDiscordRetryableError,
  tryDiscordInterimEdit,
  withDiscordRetry,
} from "./discord/discord-retry.ts";
describe("discordErrorDetails", () => {
  it("提取 http status 与 discord code", () => {
    expect(
      discordErrorDetails({
        status: 403,
        code: 50005,
        message: "Cannot edit a message authored by another user",
      }),
    ).toEqual({
      http_status: 403,
      discord_code: 50005,
      discord_message: "Cannot edit a message authored by another user",
    });
  });

  it("非对象返回空", () => {
    expect(discordErrorDetails(null)).toEqual({});
  });
});

describe("isDiscordRetryableError", () => {
  it("429 与 5xx 可重试", () => {
    expect(isDiscordRetryableError({ status: 429 })).toBe(true);
    expect(isDiscordRetryableError({ status: 503 })).toBe(true);
    expect(isDiscordRetryableError(new TypeError("fetch failed"))).toBe(true);
  });

  it("4xx 业务错误不重试", () => {
    expect(isDiscordRetryableError({ status: 403 })).toBe(false);
    expect(isDiscordRetryableError(new Error("Session not found"))).toBe(false);
  });
});

describe("withDiscordRetry", () => {
  it("瞬态错误重试后成功", async () => {
    let n = 0;
    const result = await withDiscordRetry(async () => {
      n++;
      if (n < 2) throw { status: 503 };
      return "ok";
    }, 3);
    expect(result).toBe("ok");
    expect(n).toBe(2);
  });
});

describe("tryDiscordInterimEdit", () => {
  it("失败不抛出", async () => {
    await expect(
      tryDiscordInterimEdit(async () => {
        throw { status: 403 };
      }),
    ).resolves.toBeUndefined();
  });
});

describe("deliverDiscordFinalContent", () => {
  it("edit 失败时 fallback send", async () => {
    const edit = vi.fn(async () => {
      throw { status: 403 };
    });
    const send = vi.fn(async () => {});
    await deliverDiscordFinalContent(edit, send);
    expect(edit).toHaveBeenCalled();
    expect(send).toHaveBeenCalled();
  });
});

import { describe, expect, mock, test } from "bun:test";

import { resolveSentCopyUid } from "./sent-copy.ts";

describe("resolveSentCopyUid", () => {
  test("returns SEARCH hit and skips APPEND", async () => {
    const searchUid = mock(async () => 42);
    const append = mock(async () => 99);
    const sleep = mock(async () => undefined);

    const uid = await resolveSentCopyUid({
      searchUid,
      append,
      sleep,
      delayMs: 10,
      searchAttempts: 3,
    });

    expect(uid).toBe(42);
    expect(searchUid).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  test("retries SEARCH then APPENDs when never found", async () => {
    const searchUid = mock(async () => null);
    const append = mock(async () => 7);
    const sleep = mock(async () => undefined);

    const uid = await resolveSentCopyUid({
      searchUid,
      append,
      sleep,
      delayMs: 5,
      searchAttempts: 3,
    });

    expect(uid).toBe(7);
    expect(searchUid).toHaveBeenCalledTimes(3);
    expect(append).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  test("hits on second SEARCH attempt without APPEND", async () => {
    let n = 0;
    const searchUid = mock(async () => {
      n += 1;
      return n === 2 ? 55 : null;
    });
    const append = mock(async () => 1);
    const sleep = mock(async () => undefined);

    const uid = await resolveSentCopyUid({
      searchUid,
      append,
      sleep,
      delayMs: 1,
      searchAttempts: 3,
    });

    expect(uid).toBe(55);
    expect(searchUid).toHaveBeenCalledTimes(2);
    expect(append).not.toHaveBeenCalled();
  });
});

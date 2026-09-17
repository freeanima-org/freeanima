import { afterEach, describe, expect, test } from "bun:test";

import {
  createLlmTimeoutController,
  extractLlmTimeoutError,
  LlmTimeoutError,
  mergeAbortSignals,
} from "./request-timeouts.ts";

describe("createLlmTimeoutController", () => {
  const controllers: Array<{ dispose: () => void }> = [];
  afterEach(() => {
    for (const c of controllers) c.dispose();
    controllers.length = 0;
  });

  test("first_byte fires when no onFirstByte", async () => {
    const c = createLlmTimeoutController({
      overallMs: 5_000,
      firstByteMs: 30,
      idleMs: null,
    });
    controllers.push(c);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("expected abort")), 200);
      c.signal.addEventListener("abort", () => {
        clearTimeout(t);
        const reason = c.signal.reason;
        expect(reason).toBeInstanceOf(LlmTimeoutError);
        expect((reason as LlmTimeoutError).kind).toBe("first_byte");
        resolve();
      });
    });
  });

  test("onFirstByte clears first_byte; idle fires if no chunks", async () => {
    const c = createLlmTimeoutController({
      overallMs: 5_000,
      firstByteMs: 5_000,
      idleMs: 40,
    });
    controllers.push(c);
    c.onFirstByte();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("expected idle abort")), 300);
      c.signal.addEventListener("abort", () => {
        clearTimeout(t);
        expect((c.signal.reason as LlmTimeoutError).kind).toBe("idle");
        resolve();
      });
    });
  });

  test("onChunk resets idle", async () => {
    const c = createLlmTimeoutController({
      overallMs: 5_000,
      firstByteMs: 5_000,
      idleMs: 50,
    });
    controllers.push(c);
    c.onChunk();
    await Bun.sleep(30);
    c.onChunk();
    await Bun.sleep(30);
    expect(c.signal.aborted).toBe(false);
    c.dispose();
  });

  test("overall fires", async () => {
    const c = createLlmTimeoutController({
      overallMs: 40,
      firstByteMs: 5_000,
      idleMs: null,
    });
    controllers.push(c);
    // prevent first_byte from winning
    c.onFirstByte();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("expected overall abort")), 300);
      c.signal.addEventListener("abort", () => {
        clearTimeout(t);
        expect((c.signal.reason as LlmTimeoutError).kind).toBe("overall");
        resolve();
      });
    });
  });

  test("external abort 不记为 timeout", async () => {
    const external = new AbortController();
    const c = createLlmTimeoutController({
      overallMs: 5_000,
      firstByteMs: 5_000,
      idleMs: null,
      external: external.signal,
    });
    controllers.push(c);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("expected abort")), 200);
      c.signal.addEventListener("abort", () => {
        clearTimeout(t);
        expect(c.signal.reason).not.toBeInstanceOf(LlmTimeoutError);
        resolve();
      });
      external.abort();
    });
  });
});

describe("mergeAbortSignals", () => {
  test("without external returns timeout signal", () => {
    const c = createLlmTimeoutController({
      overallMs: 5_000,
      firstByteMs: 5_000,
      idleMs: null,
    });
    expect(mergeAbortSignals(c.signal)).toBe(c.signal);
    expect(mergeAbortSignals(c.signal, null)).toBe(c.signal);
    c.dispose();
  });

  test("external abort aborts merged signal", () => {
    const c = createLlmTimeoutController({
      overallMs: 60_000,
      firstByteMs: 60_000,
      idleMs: null,
    });
    const external = new AbortController();
    const merged = mergeAbortSignals(c.signal, external.signal);
    expect(merged.aborted).toBe(false);
    external.abort(new Error("wall-clock"));
    expect(merged.aborted).toBe(true);
    c.dispose();
  });

  test("timeout abort aborts merged signal", async () => {
    const c = createLlmTimeoutController({
      overallMs: 40,
      firstByteMs: 5_000,
      idleMs: null,
    });
    c.onFirstByte();
    const external = new AbortController();
    const merged = mergeAbortSignals(c.signal, external.signal);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("expected merged abort")), 300);
      merged.addEventListener("abort", () => {
        clearTimeout(t);
        expect(merged.aborted).toBe(true);
        resolve();
      });
    });
    c.dispose();
  });
});

describe("extractLlmTimeoutError", () => {
  test("finds reason on AbortError-like chain", () => {
    const inner = new LlmTimeoutError("idle", 120);
    const abort = new Error("aborted", { cause: inner });
    abort.name = "AbortError";
    expect(extractLlmTimeoutError(abort)?.kind).toBe("idle");
  });
});

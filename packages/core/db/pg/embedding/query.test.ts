import { afterEach, describe, expect, it, mock } from "bun:test";

import { embedQueryText, setQueryTimeoutMsForTest } from "./query.ts";
import { registerEmbedTextFn, resetEmbedTextFnForTest } from "./runtime.ts";

describe("embedQueryText", () => {
  afterEach(() => {
    resetEmbedTextFnForTest();
    setQueryTimeoutMsForTest(null);
  });

  it("returns null when embedding is not configured", async () => {
    expect(await embedQueryText("hello")).toBeNull();
  });

  it("returns null for blank query without calling embed", async () => {
    const embed = mock(async () => [0.1]);
    registerEmbedTextFn(embed);
    expect(await embedQueryText("   ")).toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });

  it("returns embedding vector on success", async () => {
    const vector = [0.1, 0.2];
    registerEmbedTextFn(async () => vector);
    expect(await embedQueryText("hello")).toEqual(vector);
  });

  it("returns null when upstream embedding fails", async () => {
    registerEmbedTextFn(async () => {
      throw new Error("404 page not found");
    });
    expect(await embedQueryText("hello")).toBeNull();
  });

  it("returns null when embed exceeds query timeout", async () => {
    setQueryTimeoutMsForTest(40);
    registerEmbedTextFn(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
      return [0.1, 0.2];
    });

    const started = performance.now();
    expect(await embedQueryText("hello")).toBeNull();
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(300);
  });
});

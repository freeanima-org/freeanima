import { afterEach, describe, expect, it, mock } from "bun:test";

import { embedQueryText } from "./query.ts";
import { registerEmbedTextFn, resetEmbedTextFnForTest } from "./runtime.ts";

describe("embedQueryText", () => {
  afterEach(() => {
    resetEmbedTextFnForTest();
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
});

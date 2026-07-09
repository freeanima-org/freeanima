import { afterEach, describe, expect, it, mock } from "bun:test";

const segmentForFtsMock = mock(async (_text: string) => {
  throw new Error("jieba failed");
});

mock.module("@freeanima/core/config", () => ({
  getActiveRuntimeConfig: () => ({ data: {} }),
  isCjkJiebaEnabled: () => true,
}));

mock.module("./segment.ts", () => ({
  segmentForFts: segmentForFtsMock,
}));

import { resolveFtsSegmentedForWrite } from "./write.ts";

describe("resolveFtsSegmentedForWrite", () => {
  afterEach(() => {
    segmentForFtsMock.mockClear();
  });

  it("returns null when segmentation throws", async () => {
    const out = await resolveFtsSegmentedForWrite("hello world");
    expect(out).toBeNull();
    expect(segmentForFtsMock).toHaveBeenCalledTimes(1);
  });
});

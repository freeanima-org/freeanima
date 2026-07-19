import { describe, expect, it } from "bun:test";

import { mapApkDownloadProgressEvent } from "./apk-installer.ts";

describe("mapApkDownloadProgressEvent", () => {
  it("forwards percent-capable totals and phase", () => {
    expect(
      mapApkDownloadProgressEvent({
        received: 50,
        total: 100,
        phase: "downloading",
      }),
    ).toEqual({
      received: 50,
      total: 100,
      phase: "downloading",
    });
  });

  it("maps missing/invalid total to null", () => {
    expect(mapApkDownloadProgressEvent({ received: 12 })).toEqual({
      received: 12,
      total: null,
    });
    expect(mapApkDownloadProgressEvent({ received: 12, total: Number.NaN })).toEqual({
      received: 12,
      total: null,
    });
  });
});

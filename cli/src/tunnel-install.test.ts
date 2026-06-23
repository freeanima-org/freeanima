import { describe, expect, test } from "bun:test";
import { manualDownloadHint } from "./tunnel-install.ts";

describe("tunnel-install", () => {
  test("manualDownloadHint returns cloudflare release URL", () => {
    const url = manualDownloadHint();
    expect(url).toContain("github.com/cloudflare/cloudflared/releases");
    expect(url).toContain("cloudflared");
  });
});

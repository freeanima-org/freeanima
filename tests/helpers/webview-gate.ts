import { describe } from "bun:test";
import { pgTestUrl } from "./pg-test-gate.ts";

/** Bun.WebView 可用（实验性 API，Linux 需安装 Chromium） */
export function isWebViewAvailable(): boolean {
  return typeof (Bun as { WebView?: unknown }).WebView === "function";
}

export const describeWebView = isWebViewAvailable() ? describe : describe.skip;

/** E2E 需 WebView + 集成 PG（`bun run test:e2e` 注入） */
export const describeE2e = isWebViewAvailable() && pgTestUrl ? describe : describe.skip;

import { describe } from "bun:test";
import { pgTestUrl } from "./pg-test-gate.ts";

/** Bun.WebView 可用（实验性 API，Linux 需安装 Chromium） */
export function isWebViewAvailable(): boolean {
  return typeof (Bun as { WebView?: unknown }).WebView === "function";
}

function hasWebViewBackend(): boolean {
  if (process.env.BUN_CHROME_PATH) return true;
  const probe = Bun.spawnSync({
    cmd: [
      "sh",
      "-c",
      "command -v chromium || command -v google-chrome || command -v chromium-browser",
    ],
    stdout: "ignore",
    stderr: "ignore",
  });
  return probe.exitCode === 0;
}

export const describeWebView =
  isWebViewAvailable() && hasWebViewBackend() ? describe : describe.skip;

/** E2E 需 WebView + Chromium + 集成 PG（`bun run test:e2e` 注入） */
export const describeE2e =
  isWebViewAvailable() && hasWebViewBackend() && pgTestUrl ? describe : describe.skip;

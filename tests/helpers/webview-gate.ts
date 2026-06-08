import { describe } from "bun:test";
import { pgTestUrl } from "./pg-test-gate.ts";

/** Bun.WebView 可用（实验性 API，Linux 需安装 Chromium） */
export function isWebViewAvailable(): boolean {
  return typeof (Bun as { WebView?: unknown }).WebView === "function";
}

export function resolveChromePath(): string | undefined {
  if (process.env.BUN_CHROME_PATH?.trim()) return process.env.BUN_CHROME_PATH.trim();
  const probe = Bun.spawnSync({
    cmd: [
      "sh",
      "-c",
      "command -v chromium || command -v chromium-browser || command -v google-chrome",
    ],
    stdout: "pipe",
    stderr: "ignore",
  });
  if (probe.exitCode !== 0) return undefined;
  const out = probe.stdout?.toString().trim();
  return out || undefined;
}

function hasWebViewBackend(): boolean {
  return resolveChromePath() !== undefined;
}

/** CI / 容器内 Chromium 常见崩溃：追加 no-sandbox 与 disable-dev-shm-usage */
export function createE2eWebView(opts: {
  width: number;
  height: number;
}): InstanceType<typeof Bun.WebView> {
  const path = resolveChromePath();
  if (!path) {
    throw new Error("未找到 Chromium，请安装或设置 BUN_CHROME_PATH");
  }
  return new Bun.WebView({
    width: opts.width,
    height: opts.height,
    backend: {
      type: "chrome",
      url: false,
      path,
      argv: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  });
}

export const describeWebView =
  isWebViewAvailable() && hasWebViewBackend() ? describe : describe.skip;

/** E2E 需 WebView + Chromium + 集成 PG（`bun run test:e2e` 注入） */
export const describeE2e =
  isWebViewAvailable() && hasWebViewBackend() && pgTestUrl ? describe : describe.skip;

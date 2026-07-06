import { expect, test } from "bun:test";

import { shellEntryFileNames, SHELL_BRIDGE_ASSET_PREFIX } from "./entry-file-names.ts";
import { arrangeShellBridgeIndexHtml } from "./shell-bridge-html.ts";

test("shellEntryFileNames shell-bridge 输出到 assets 且带 hash", () => {
  expect(shellEntryFileNames({ name: "shell-bridge" })).toBe("assets/shell-bridge-[hash].js");
  expect(SHELL_BRIDGE_ASSET_PREFIX).toBe("shell-bridge-");
});

const MAIN_SCRIPT =
  '<script type="module" crossorigin src="/web/assets/main-mHnIUgHY.js"></script>';

test("arrangeShellBridgeIndexHtml 在 main 前注入 hashed shell-bridge", () => {
  const html = `<!doctype html><html><head>${MAIN_SCRIPT}</head><body><div id="root"></div></body></html>`;
  const out = arrangeShellBridgeIndexHtml(html, "/web/assets/shell-bridge-abc.js");
  expect(out).toContain('src="/web/assets/shell-bridge-abc.js"');
  expect(out.indexOf("shell-bridge-abc.js")).toBeLessThan(out.indexOf("main-mHnIUgHY.js"));
});

test("arrangeShellBridgeIndexHtml 相对路径 base", () => {
  const html = `<!doctype html><html><body>${MAIN_SCRIPT.replace("/web/", "./")}</body></html>`;
  const out = arrangeShellBridgeIndexHtml(html, "./assets/shell-bridge-abc.js");
  expect(out).toContain('src="./assets/shell-bridge-abc.js"');
});

test("arrangeShellBridgeIndexHtml 替换已有 shell-bridge 引用", () => {
  const html = `<!doctype html><html><body>
    <script type="module" crossorigin src="/web/assets/shell-bridge-old.js"></script>
    ${MAIN_SCRIPT}
  </body></html>`;
  const out = arrangeShellBridgeIndexHtml(html, "/web/assets/shell-bridge-new.js");
  expect(out).not.toContain("shell-bridge-old.js");
  expect(out).toContain("shell-bridge-new.js");
});

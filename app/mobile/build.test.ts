import { expect, test } from "bun:test";

import { arrangeMobileIndexHtml } from "./build.ts";

const MAIN_SCRIPT = '<script type="module" crossorigin src="./chunk-main.js"></script>';

test("arrangeMobileIndexHtml 在占位符 root 下仍注入 shell-bridge 与主 bundle", () => {
  const html = `<!doctype html><html><body>
    <div id="root">
      <div id="shell-boot-placeholder">加载中…</div>
    </div>
    ${MAIN_SCRIPT}
  </body></html>`;

  const out = arrangeMobileIndexHtml(html);
  expect(out).toContain('src="./shell-bridge.js"');
  expect(out).toContain('src="./chunk-main.js"');
  expect(out.indexOf("shell-bridge.js")).toBeLessThan(out.indexOf("chunk-main.js"));
});

test("arrangeMobileIndexHtml 无主 bundle 时仍注入 shell-bridge", () => {
  const html = `<!doctype html><html><body><div id="root"></div></body></html>`;
  const out = arrangeMobileIndexHtml(html);
  expect(out).toContain('src="./shell-bridge.js"');
});

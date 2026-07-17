import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { startWebStaticServer } from "./static-server.ts";

describe("startWebStaticServer", () => {
  test("serves index, health, and config.json under /web", async () => {
    const dist = mkdtempSync(join(tmpdir(), "web-dist-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");

    const handle = await startWebStaticServer({
      distDir: dist,
      host: "127.0.0.1",
      port: 0,
      runtime: { appId: "chat", hubUrl: "https://anima.example.com" },
    });

    const port = handle.port;
    const health = await fetch(`http://127.0.0.1:${port}/web/health`);
    expect(health.ok).toBe(true);

    const cfg = (await fetch(`http://127.0.0.1:${port}/web/config.json`).then((r) => r.json())) as {
      hub_url?: string;
    };
    expect(cfg.hub_url).toBe("https://anima.example.com");

    const page = await fetch(`http://127.0.0.1:${port}/web/chat`);
    expect(page.ok).toBe(true);
    expect(await page.text()).toContain("ok");

    await handle.close();
  });

  test("config.json uses request origin when hubUrl omitted", async () => {
    const dist = mkdtempSync(join(tmpdir(), "web-dist-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");

    const handle = await startWebStaticServer({
      distDir: dist,
      host: "127.0.0.1",
      port: 0,
      runtime: { appId: "chat" },
    });

    try {
      const port = handle.port;
      const cfg = (await fetch(`http://127.0.0.1:${port}/web/config.json`).then((r) =>
        r.json(),
      )) as { hub_url?: string; hub_ws_url?: string };
      expect(cfg.hub_url).toBe(`http://127.0.0.1:${port}`);
      expect(cfg.hub_ws_url).toBe(`ws://127.0.0.1:${port}/hub/rpc/v1`);
    } finally {
      await handle.close();
    }
  });

  test("falls back to index.html for deep console routes and serves root assets", async () => {
    const dist = mkdtempSync(join(tmpdir(), "web-dist-"));
    const indexHtml =
      '<html><head><script src="/web/assets/main.js"></script></head><body>ok</body></html>';
    writeFileSync(join(dist, "index.html"), indexHtml);
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "assets", "main.js"), "console.log('ok');");

    const handle = await startWebStaticServer({
      distDir: dist,
      host: "127.0.0.1",
      port: 0,
    });

    const port = handle.port;
    const adminPage = await fetch(`http://127.0.0.1:${port}/web/console/dashboard`);
    expect(adminPage.ok).toBe(true);
    expect(await adminPage.text()).toContain('src="/web/assets/main.js"');

    const asset = await fetch(`http://127.0.0.1:${port}/web/assets/main.js`);
    expect(asset.ok).toBe(true);
    expect(await asset.text()).toContain("console.log('ok')");

    await handle.close();
  });
});

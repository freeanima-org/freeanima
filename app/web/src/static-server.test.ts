import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { startWebStaticServer } from "./static-server.ts";

describe("startWebStaticServer", () => {
  test("serves index, health, and config.json", async () => {
    const dist = mkdtempSync(join(tmpdir(), "web-dist-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");

    const handle = await startWebStaticServer({
      distDir: dist,
      host: "127.0.0.1",
      port: 0,
      runtime: { appId: "chat", hubUrl: "https://anima.example.com" },
    });

    const port = handle.port;
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.ok).toBe(true);

    const cfg = (await fetch(`http://127.0.0.1:${port}/config.json`).then((r) => r.json())) as {
      hub_url?: string;
    };
    expect(cfg.hub_url).toBe("https://anima.example.com");

    const page = await fetch(`http://127.0.0.1:${port}/chat`);
    expect(page.ok).toBe(true);
    expect(await page.text()).toContain("ok");

    await handle.close();
  });
});

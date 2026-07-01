import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { isWebStaticPath, serveWebStatic, webPathToDistRel, WEB_URL_PREFIX } from "./web-static.ts";

describe("web-static", () => {
  test("isWebStaticPath", () => {
    expect(isWebStaticPath("/web")).toBe(true);
    expect(isWebStaticPath("/web/chat")).toBe(true);
    expect(isWebStaticPath("/api/health")).toBe(false);
  });

  test("webPathToDistRel", () => {
    expect(webPathToDistRel("/web")).toBe("/");
    expect(webPathToDistRel("/web/assets/main.js")).toBe("/assets/main.js");
  });

  test("serveWebStatic serves files and config.json", async () => {
    const dist = mkdtempSync(join(tmpdir(), "hub-web-dist-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "assets", "main.js"), "ok");
    writeFileSync(join(dist, "assets", "chunk-abc.js"), "/* chunk */");

    const base = "http://127.0.0.1:2658";
    const opts = { distDir: dist, appId: "chat" };

    const redirect = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}`), opts);
    expect(redirect?.status).toBe(302);
    expect(redirect?.headers.get("Location")).toBe(`${base}${WEB_URL_PREFIX}/chat`);

    const cfgRes = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/config.json`), opts);
    expect(cfgRes?.ok).toBe(true);
    const cfg = (await cfgRes!.json()) as { hub_url?: string; hub_ws_url?: string };
    expect(cfg.hub_url).toBe(base);
    expect(cfg.hub_ws_url).toContain("/sap/v1");

    const health = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/health`), opts);
    expect(health?.ok).toBe(true);

    const page = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/chat`), opts);
    expect(await page!.text()).toContain("ok");

    const asset = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/assets/main.js`), opts);
    expect(await asset!.text()).toBe("ok");

    const chunk = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/assets/chunk-abc.js`), opts);
    expect(chunk?.ok).toBe(true);
    expect(await chunk!.text()).toBe("/* chunk */");
  });
});

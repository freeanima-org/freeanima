import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildFileEtag,
  isWebStaticPath,
  readWebBuildMetaFromDist,
  serveWebStatic,
  webPathToDistRel,
  WEB_URL_PREFIX,
} from "./web-static.ts";

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

  test("readWebBuildMetaFromDist reads build-meta.json", () => {
    const dist = mkdtempSync(join(tmpdir(), "hub-web-meta-"));
    writeFileSync(
      join(dist, "build-meta.json"),
      JSON.stringify({
        component: "web",
        version: "0.8.3",
        channel: "release",
        built_at: "2026-07-08T00:00:00.000Z",
      }),
    );
    expect(readWebBuildMetaFromDist(dist)?.version).toBe("0.8.3");
  });

  test("serveWebStatic config.json includes web_build from dist", async () => {
    const dist = mkdtempSync(join(tmpdir(), "hub-web-dist-meta-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");
    writeFileSync(
      join(dist, "build-meta.json"),
      JSON.stringify({
        component: "web",
        version: "0.8.3",
        channel: "release",
        built_at: "2026-07-08T00:00:00.000Z",
      }),
    );
    const base = "http://127.0.0.1:2658";
    const cfgRes = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/config.json`), {
      distDir: dist,
      appId: "chat",
    });
    expect(cfgRes?.ok).toBe(true);
    const cfg = (await cfgRes!.json()) as { web_build?: { version?: string; component?: string } };
    expect(cfg.web_build?.component).toBe("web");
    expect(cfg.web_build?.version).toBe("0.8.3");
  });

  test("serveWebStatic serves files, config.json, and conditional GET", async () => {
    const dist = mkdtempSync(join(tmpdir(), "hub-web-dist-"));
    writeFileSync(join(dist, "index.html"), "<html>ok</html>");
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "assets", "main.js"), "ok");
    writeFileSync(join(dist, "assets", "shell-bridge-abc.js"), "bridge");
    writeFileSync(join(dist, "assets", "chunk-abc.js"), "/* chunk */");

    const base = "http://127.0.0.1:2658";
    const opts = { distDir: dist, appId: "chat" };

    const redirect = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}`), opts);
    expect(redirect?.status).toBe(302);
    expect(redirect?.headers.get("Location")).toBe(`${base}${WEB_URL_PREFIX}/chat`);

    const cfgRes = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/config.json`), opts);
    expect(cfgRes?.ok).toBe(true);
    const cfg = (await cfgRes!.json()) as {
      habitat_url?: string;
      habitat_ws_url?: string;
      hub_url?: string;
      hub_ws_url?: string;
      ui_version?: string;
    };
    expect(cfg.habitat_url ?? cfg.hub_url).toBe(base);
    expect(cfg.habitat_ws_url ?? cfg.hub_ws_url).toContain("/rpc/v1");

    const asset = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/assets/main.js`), {
      ...opts,
      uiVersion: "0.8.1",
    });
    expect(asset?.headers.get("Cache-Control")).toContain("immutable");
    expect(await asset!.text()).toBe("ok");

    const bridge = serveWebStatic(
      new Request(`${base}${WEB_URL_PREFIX}/assets/shell-bridge-abc.js`),
      opts,
    );
    expect(bridge?.headers.get("Cache-Control")).toContain("immutable");

    const health = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/health`), opts);
    expect(health?.ok).toBe(true);

    const page = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/chat`), opts);
    expect(page?.headers.get("Cache-Control")).toBe("no-cache");
    expect(page?.headers.get("ETag")).toBeTruthy();
    expect(await page!.text()).toContain("ok");

    const etag = buildFileEtag(join(dist, "index.html"));
    const notModified = serveWebStatic(
      new Request(`${base}${WEB_URL_PREFIX}/chat`, { headers: { "If-None-Match": etag } }),
      opts,
    );
    expect(notModified?.status).toBe(304);

    const chunk = serveWebStatic(new Request(`${base}${WEB_URL_PREFIX}/assets/chunk-abc.js`), opts);
    expect(chunk?.ok).toBe(true);
    expect(await chunk!.text()).toBe("/* chunk */");
  });

  test("buildFileEtag 随文件 mtime 变化", () => {
    const dist = mkdtempSync(join(tmpdir(), "hub-web-etag-"));
    const filePath = join(dist, "index.html");
    writeFileSync(filePath, "v1");
    const etag1 = buildFileEtag(filePath);
    const past = Date.now() - 60_000;
    utimesSync(filePath, past / 1000, past / 1000);
    const etag2 = buildFileEtag(filePath);
    expect(etag1).not.toBe(etag2);
  });
});

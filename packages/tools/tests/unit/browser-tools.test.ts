import { runWithToolContext } from "@freeanima/legacy-engine";
import { getTool, listTools, clearConfigCache } from "@freeanima/legacy-kernel";
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { registerAllTools } from "@freeanima/legacy-tools";
import {
  camofoxNavigate,
  camofoxSnapshot,
  checkCamofoxAvailable,
  getCamofoxUrl,
  isCamofoxConfigured,
  resetCamofoxSessionsForTests,
} from "../../src/browser-camofox";

const BROWSER_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_scroll",
  "browser_back",
  "browser_press",
  "browser_console",
  "browser_get_images",
  "browser_vision",
];

let savedFetch: typeof fetch | undefined;

function stubFetch(impl: typeof fetch): void {
  savedFetch = globalThis.fetch;
  globalThis.fetch = impl;
}

function restoreFetch(): void {
  if (savedFetch !== undefined) {
    globalThis.fetch = savedFetch;
    savedFetch = undefined;
  }
}

function writeBrowserConfig(home: string, baseUrl?: string): void {
  const body =
    baseUrl === undefined
      ? "browser:\n  camofox: {}\n"
      : `browser:\n  camofox:\n    base_url: ${baseUrl}\n`;
  writeFileSync(join(home, "config.yaml"), body, "utf-8");
  clearConfigCache();
}

describe("browser tools", () => {
  let home: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeAll(() => {
    registerAllTools();
  });

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "anima-browser-"));
    process.env.FREEANIMA_HOME = home;
    writeBrowserConfig(home, "http://localhost:9377");
    resetCamofoxSessionsForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreFetch();
    resetCamofoxSessionsForTests();
    clearConfigCache();
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("registers browser_* tools", () => {
    const names = new Set(listTools().map((t) => t.name));
    for (const name of BROWSER_TOOLS) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("browser tools use toolset browser", () => {
    for (const name of BROWSER_TOOLS) {
      expect(getTool(name)?.toolset).toBe("browser");
    }
  });

  it("isCamofoxConfigured reads browser.camofox.base_url from config.yaml", () => {
    expect(isCamofoxConfigured()).toBe(true);
    writeBrowserConfig(home);
    expect(isCamofoxConfigured()).toBe(false);
  });

  it("browser_navigate requires url", async () => {
    const out = await getTool("browser_navigate")!.handler({ url: "  " });
    const data = JSON.parse(out);
    expect(data.error).toContain("url");
  });

  it("browser_navigate errors when camofox not configured", async () => {
    writeBrowserConfig(home);
    const out = await getTool("browser_navigate")!.handler({ url: "https://example.com" });
    const data = JSON.parse(out);
    expect(data.error).toContain("config.yaml");
  });

  it("browser_click requires ref", async () => {
    const out = await getTool("browser_click")!.handler({});
    const data = JSON.parse(out);
    expect(data.error).toContain("ref");
  });

  it("browser_scroll rejects invalid direction", async () => {
    const out = await getTool("browser_scroll")!.handler({ direction: "left" });
    const data = JSON.parse(out);
    expect(data.error).toContain("direction");
  });

  it("browser_console returns limited support note", async () => {
    const out = await getTool("browser_console")!.handler({});
    const data = JSON.parse(out);
    expect(data.success).toBe(true);
    expect(data.total_messages).toBe(0);
    expect(data.note).toContain("Camofox");
  });

  it("camofoxNavigate creates tab on first navigate", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab1", url: "https://example.com" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "- button \"Go\" [e1]", refsCount: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    const out = JSON.parse(await camofoxNavigate("sess-a", "https://example.com"));
    expect(out.success).toBe(true);
    expect(out.url).toBe("https://example.com");
    expect(out.snapshot).toContain("[e1]");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("camofoxNavigate reuses tab on second navigate", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab-reuse", url: "https://a.com" }), {
          status: 200,
        });
      }
      if (url.includes("/navigate") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, url: "https://b.com", title: "B" }), {
          status: 200,
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "ok", refsCount: 0 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    await camofoxNavigate("sess-b", "https://a.com");
    const out = JSON.parse(await camofoxNavigate("sess-b", "https://b.com"));
    expect(out.success).toBe(true);
    expect(out.url).toBe("https://b.com");
    const navigateCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/navigate"));
    expect(navigateCalls.length).toBe(1);
  });

  it("camofoxSnapshot errors without prior navigate", async () => {
    const out = JSON.parse(await camofoxSnapshot("fresh-session"));
    expect(out.error).toContain("browser_navigate");
  });

  it("browser tools bind to tool session context", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab-ctx", url: "https://ctx.test" }), {
          status: 200,
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "ctx", refsCount: 0 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    await runWithToolContext("ctx-session-123", async () => {
      const out = JSON.parse(
        await getTool("browser_navigate")!.handler({ url: "https://ctx.test" }),
      );
      expect(out.success).toBe(true);
    });

    resetCamofoxSessionsForTests();
    const out = JSON.parse(await camofoxSnapshot("ctx-session-123"));
    expect(out.error).toContain("browser_navigate");
  });

  it("checkCamofoxAvailable probes /health", async () => {
    stubFetch(
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch,
    );
    await expect(checkCamofoxAvailable()).resolves.toBe(true);
    expect(getCamofoxUrl()).toBe("http://localhost:9377");
  });
});

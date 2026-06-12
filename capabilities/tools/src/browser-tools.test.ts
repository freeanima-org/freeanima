import { runWithToolContext } from "@freeanima/core/tool";
import { SkillRegistry } from "@freeanima/core/skill";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { Config } from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { bindBrowserToolsConfig, resetBrowserToolsConfigForTest } from "./browser-camofox.ts";
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "bun:test";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";

import { registerSupplementalTools } from "@freeanima/capabilities-tools";
import {
  camofoxNavigate,
  camofoxSnapshot,
  checkCamofoxAvailable,
  getCamofoxUrl,
  isCamofoxConfigured,
  resetCamofoxSessionsForTests,
} from "./browser-camofox.ts";

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

const toolSets = new ToolSetRegistry();
const skills = new SkillRegistry();

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

function browserConfig(baseUrl?: string) {
  const browser =
    baseUrl === undefined
      ? "browser:\n  camofox: {}\n"
      : `browser:\n  camofox:\n    base_url: ${baseUrl}\n`;
  const raw = parseYaml(`${MINIMAL_LLM_YAML}\n${browser}`);
  const parsed = animaConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("browser tools", () => {
  beforeAll(() => {
    const config = Config.fromSnapshot(browserConfig("http://localhost:9377"));
    registerSupplementalTools(toolSets, skills, config);
  });

  beforeEach(() => {
    bindBrowserToolsConfig(Config.fromSnapshot(browserConfig("http://localhost:9377")));
    resetCamofoxSessionsForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreFetch();
    resetCamofoxSessionsForTests();
    resetBrowserToolsConfigForTest();
  });

  it("registers browser_* tools", () => {
    const names = new Set(toolSets.listTools().map((t) => t.name));
    for (const name of BROWSER_TOOLS) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("browser tools belong to browser toolset", () => {
    const ts = toolSets.getToolSet("browser");
    expect(ts?.tools.map((t) => t.name).toSorted()).toEqual([...BROWSER_TOOLS].toSorted());
  });

  it("isCamofoxConfigured reads browser.camofox.base_url from config.yaml", () => {
    expect(isCamofoxConfigured()).toBe(true);
    bindBrowserToolsConfig(Config.fromSnapshot(browserConfig()));
    expect(isCamofoxConfigured()).toBe(false);
  });

  it("browser_navigate requires url", async () => {
    const out = await toolSets.getTool("browser_navigate")!.handler({ url: "  " });
    const data = JSON.parse(out);
    expect(data.error).toContain("url");
  });

  it("browser_navigate errors when camofox not configured", async () => {
    bindBrowserToolsConfig(Config.fromSnapshot(browserConfig()));
    const out = await toolSets.getTool("browser_navigate")!.handler({ url: "https://example.com" });
    const data = JSON.parse(out);
    expect(data.error).toContain("config.yaml");
  });

  it("browser_click requires ref", async () => {
    const out = await toolSets.getTool("browser_click")!.handler({});
    const data = JSON.parse(out);
    expect(data.error).toContain("ref");
  });

  it("browser_scroll rejects invalid direction", async () => {
    const out = await toolSets.getTool("browser_scroll")!.handler({ direction: "left" });
    const data = JSON.parse(out);
    expect(data.error).toContain("direction");
  });

  it("browser_console returns limited support note", async () => {
    const out = await toolSets.getTool("browser_console")!.handler({});
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
        return new Response(JSON.stringify({ snapshot: '- button "Go" [e1]', refsCount: 1 }), {
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

    await runWithToolContext(
      "ctx-session-123",
      async () => {
        const out = JSON.parse(
          await toolSets.getTool("browser_navigate")!.handler({ url: "https://ctx.test" }),
        );
        expect(out.success).toBe(true);
      },
      { tools: toolSets },
    );

    resetCamofoxSessionsForTests();
    const out = JSON.parse(await camofoxSnapshot("ctx-session-123"));
    expect(out.error).toContain("browser_navigate");
  });

  it("checkCamofoxAvailable probes /health", async () => {
    stubFetch(
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ) as unknown as typeof fetch,
    );
    await expect(checkCamofoxAvailable()).resolves.toBe(true);
    expect(getCamofoxUrl()).toBe("http://localhost:9377");
  });
});

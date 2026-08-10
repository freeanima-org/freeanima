import { runWithToolContext } from "@freeanima/host/core/tool";
import { SkillRegistry } from "@freeanima/host/core/skill";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { Config } from "@freeanima/host/platform/config";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { bindBrowserToolsConfig, resetBrowserToolsConfigForTest } from "./browser-camofox.ts";
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "bun:test";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";

import { registerSupplementalTools } from "@freeanima/host/capabilities/tools";
import {
  camofoxNavigate,
  camofoxSnapshot,
  camofoxType,
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
  const parsed = runtimeConfigSchema.safeParse(raw);
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

  it("isCamofoxConfigured reads browser.camofox.base_url from runtime config", () => {
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
    expect(data.error).toContain("Habitat 服务配置");
  });

  it("browser_click requires ref", async () => {
    const out = await toolSets.getTool("browser_click")!.handler({});
    const data = JSON.parse(out);
    expect(data.error).toContain("ref");
  });

  it("browser_type requires text or secret", async () => {
    const out = await toolSets.getTool("browser_type")!.handler({ ref: "@e1" });
    const data = JSON.parse(out);
    expect(data.error).toContain("text or secret");
  });

  it("browser_type rejects text and secret together", async () => {
    const out = await toolSets.getTool("browser_type")!.handler({
      ref: "@e1",
      text: "x",
      secret: { id: 1, field: "password" },
    });
    const data = JSON.parse(out);
    expect(data.error).toContain("either text or secret");
  });

  it("camofoxType redacts typed when redactTyped", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab-type", url: "https://example.com" }), {
          status: 200,
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "ok", refsCount: 0 }), { status: 200 });
      }
      if (url.includes("/type") && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    await camofoxNavigate("sess-type", "https://example.com");
    const out = JSON.parse(
      await camofoxType("sess-type", "@e3", "super-secret-password", { redactTyped: true }),
    );
    expect(out.success).toBe(true);
    expect(out.typed).toBe("***");
    expect(JSON.stringify(out)).not.toContain("super-secret-password");
    const typeBody = fetchMock.mock.calls.find(([u]) => String(u).includes("/type"))?.[1] as
      | RequestInit
      | undefined;
    expect(JSON.parse(String(typeBody?.body))).toEqual({
      userId: expect.any(String),
      ref: "e3",
      text: "super-secret-password",
    });
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
    expect(typeof out.user_id).toBe("string");
    expect(out.user_id.length).toBeGreaterThan(0);
    expect(out.snapshot).toContain("[e1]");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("camofoxNavigate with user_id posts that profile on tab create", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab-profile", url: "https://example.com" }), {
          status: 200,
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "ok", refsCount: 0 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    const out = JSON.parse(
      await camofoxNavigate("sess-profile", "https://example.com", { userId: "work_account" }),
    );
    expect(out.success).toBe(true);
    expect(out.user_id).toBe("work_account");
    const createBody = fetchMock.mock.calls.find(
      ([u, init]) =>
        String(u).endsWith("/tabs") && (init as RequestInit | undefined)?.method === "POST",
    )?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(createBody?.body))).toMatchObject({
      userId: "work_account",
      url: "https://example.com",
    });
  });

  it("camofoxNavigate switches profile when user_id changes", async () => {
    let tabCreateCount = 0;
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        tabCreateCount += 1;
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ tabId: `tab-${body.userId}`, url: body.url }), {
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

    const first = JSON.parse(
      await camofoxNavigate("sess-switch", "https://a.com", { userId: "profile_a" }),
    );
    expect(first.user_id).toBe("profile_a");
    expect(tabCreateCount).toBe(1);

    const second = JSON.parse(
      await camofoxNavigate("sess-switch", "https://b.com", { userId: "profile_b" }),
    );
    expect(second.success).toBe(true);
    expect(second.user_id).toBe("profile_b");
    expect(tabCreateCount).toBe(2);

    const third = JSON.parse(await camofoxNavigate("sess-switch", "https://c.com"));
    expect(third.user_id).toBe("profile_b");
    const navigateCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/navigate"));
    expect(navigateCalls.length).toBe(1);
  });

  it("browser_navigate passes user_id to camofox", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tabs") && init?.method === "POST") {
        return new Response(JSON.stringify({ tabId: "tab-tool", url: "https://tool.test" }), {
          status: 200,
        });
      }
      if (url.includes("/snapshot")) {
        return new Response(JSON.stringify({ snapshot: "ok", refsCount: 0 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    stubFetch(fetchMock as unknown as typeof fetch);

    await runWithToolContext(
      "tool-user-id-session",
      async () => {
        const out = JSON.parse(
          await toolSets.getTool("browser_navigate")!.handler({
            url: "https://tool.test",
            user_id: "from_tool",
          }),
        );
        expect(out.success).toBe(true);
        expect(out.user_id).toBe("from_tool");
      },
      { tools: toolSets },
    );
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

  it("browser tools bind to tool conversation context", async () => {
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

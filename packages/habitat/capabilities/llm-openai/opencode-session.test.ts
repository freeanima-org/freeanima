import { describe, expect, it } from "bun:test";
import { ToolSetRegistry, runWithToolContext } from "@freeanima/habitat/core/tool";
import {
  OPENCODE_SESSION_HEADER,
  isOpencodeGoUrl,
  requestUrlString,
  resolveOpencodeSessionId,
  wrapOpencodeSession,
} from "./opencode-session.ts";

describe("isOpencodeGoUrl", () => {
  it("accepts default OpenCode Go base", () => {
    expect(isOpencodeGoUrl("https://opencode.ai/zen/go/v1")).toBe(true);
    expect(isOpencodeGoUrl("https://opencode.ai/zen/go/v1/chat/completions")).toBe(true);
  });

  it("accepts subdomain with zen/go path", () => {
    expect(isOpencodeGoUrl("https://api.opencode.ai/zen/go/v1")).toBe(true);
  });

  it("rejects non-OpenCode or non-go paths", () => {
    expect(isOpencodeGoUrl("https://api.openai.com/v1/chat/completions")).toBe(false);
    expect(isOpencodeGoUrl("https://opencode.ai/zen/v1")).toBe(false);
    expect(isOpencodeGoUrl("https://example.com/zen/go/v1")).toBe(false);
    expect(isOpencodeGoUrl("not-a-url")).toBe(false);
  });
});

describe("requestUrlString", () => {
  it("handles string, URL, and Request", () => {
    expect(requestUrlString("https://opencode.ai/zen/go/v1")).toBe("https://opencode.ai/zen/go/v1");
    expect(requestUrlString(new URL("https://opencode.ai/zen/go/v1/x"))).toBe(
      "https://opencode.ai/zen/go/v1/x",
    );
    expect(requestUrlString(new Request("https://opencode.ai/zen/go/v1"))).toBe(
      "https://opencode.ai/zen/go/v1",
    );
  });
});

describe("resolveOpencodeSessionId", () => {
  const tools = new ToolSetRegistry();

  it("uses conversation id from tool ALS", () => {
    const id = runWithToolContext("conv_abc", () => resolveOpencodeSessionId(), { tools });
    expect(id).toBe("conv_abc");
  });

  it("uses parentConversationId for auto_llm", () => {
    const id = runWithToolContext("autollm_1", () => resolveOpencodeSessionId(), {
      tools,
      contextKind: "auto_llm",
      parentConversationId: "parent_conv",
    });
    expect(id).toBe("parent_conv");
  });

  it("falls back to auto_llm contextId when no parent", () => {
    const id = runWithToolContext("autollm_solo", () => resolveOpencodeSessionId(), {
      tools,
      contextKind: "auto_llm",
    });
    expect(id).toBe("autollm_solo");
  });

  it("falls back to UUID outside ALS", () => {
    const id = resolveOpencodeSessionId();
    expect(id.length).toBeGreaterThan(8);
    expect(id).not.toBe("conv_abc");
  });
});

describe("wrapOpencodeSession", () => {
  it("injects header for OpenCode Go URL", async () => {
    let seen: Headers | undefined;
    const wrapped = wrapOpencodeSession(async (_input, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    });
    await wrapped("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer x" },
    });
    expect(seen?.get(OPENCODE_SESSION_HEADER)).toBeTruthy();
    expect(seen?.get("authorization")).toBe("Bearer x");
  });

  it("does not inject for non-OpenCode URL", async () => {
    let seen: Headers | undefined;
    const wrapped = wrapOpencodeSession(async (_input, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    });
    await wrapped("https://api.openai.com/v1/chat/completions", {
      headers: { authorization: "Bearer x" },
    });
    expect(seen?.has(OPENCODE_SESSION_HEADER)).toBe(false);
  });

  it("does not overwrite an existing session header", async () => {
    let seen: Headers | undefined;
    const wrapped = wrapOpencodeSession(async (_input, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    });
    await wrapped("https://opencode.ai/zen/go/v1/chat/completions", {
      headers: { [OPENCODE_SESSION_HEADER]: "preset-id" },
    });
    expect(seen?.get(OPENCODE_SESSION_HEADER)).toBe("preset-id");
  });

  it("uses conversation id from ALS when present", async () => {
    const tools = new ToolSetRegistry();
    let seen: Headers | undefined;
    const wrapped = wrapOpencodeSession(async (_input, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    });
    await runWithToolContext(
      "stable_conv",
      () =>
        wrapped("https://opencode.ai/zen/go/v1/chat/completions", {
          method: "POST",
        }),
      { tools },
    );
    expect(seen?.get(OPENCODE_SESSION_HEADER)).toBe("stable_conv");
  });
});

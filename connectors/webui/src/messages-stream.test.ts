import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as handlers from "./handlers/index.ts";
import { apiApp } from "./elysia/app.ts";

function parseSseEvents(body: string): Array<{ event: string; data: Record<string, unknown> }> {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const part of body.split("\n\n")) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    const json = line.slice(5).trim();
    if (!json) continue;
    events.push(JSON.parse(json) as { event: string; data: Record<string, unknown> });
  }
  return events;
}

describe("POST /api/messages/stream", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("连续同步 yield 时仍发送 token / tool / content_replace / done", async () => {
    restores.push(
      spyOn(handlers, "iterateMessageStream").mockImplementation(async function* () {
        yield {
          event: "token",
          data: JSON.stringify({ content: "你好" }),
        };
        yield {
          event: "tool_begin",
          data: JSON.stringify({ tool: "file_read_file", args: { path: "a.ts" }, content: "" }),
        };
        yield {
          event: "content_replace",
          data: JSON.stringify({ content: "完整回复" }),
        };
        yield { event: "done", data: JSON.stringify({}) };
      }),
    );

    const res = await apiApp.handle(
      new Request("http://127.0.0.1/api/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "test-session", message: "hi" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    const events = parseSseEvents(body);
    const kinds = events.map((e) => e.event);

    expect(kinds).toContain("token");
    expect(kinds).toContain("tool_begin");
    expect(kinds).toContain("content_replace");
    expect(kinds).toContain("done");
    expect(kinds.filter((k) => k === "done")).toHaveLength(1);
    expect(events.length).toBeGreaterThanOrEqual(4);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase, endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { parseSessionLine } from "@freeanima/legacy-kernel";
import { initSession, loadSessionMeta, updateSessionMetaField } from "@freeanima/legacy-engine";

describePg("schemas/message", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeAll(async () => {
    await beginIntegrationCase("msg-schema-");
  });

  afterAll(async () => {
    await endIntegrationCase();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("parseSessionLine roundtrips minimal tool meta", () => {
    const line = JSON.stringify({
      role: "session_meta",
      model: "m",
      tools: [{ type: "function", function: { name: "keep_tool" } }],
      functions: [],
      timestamp: "t",
    });
    const parsed = parseSessionLine(line);
    expect(parsed?.role).toBe("session_meta");
    if (parsed?.role !== "session_meta") return;
    expect(parsed.tools).toEqual([{ type: "function", function: { name: "keep_tool" } }]);
  });

  it("parseSessionLine roundtrips user and assistant messages", () => {
    const userLine = JSON.stringify({ role: "user", content: "hi", timestamp: "t1" });
    const user = parseSessionLine(userLine);
    expect(user?.role).toBe("user");
    if (user?.role !== "user") return;
    expect(user.content).toBe("hi");

    const assistantLine = JSON.stringify({
      role: "assistant",
      content: "hello",
      tool_calls: [{ id: "c1", function: { name: "read_file", arguments: "{}" } }],
    });
    const assistant = parseSessionLine(assistantLine);
    expect(assistant?.role).toBe("assistant");
    if (assistant?.role !== "assistant") return;
    expect(assistant.tool_calls?.[0]?.function.name).toBe("read_file");
  });

  it("parseSessionLine rejects invalid role", () => {
    expect(parseSessionLine(JSON.stringify({ role: "invalid" }))).toBeNull();
  });

  it("updateSessionMetaField preserves acp_sessions", async () => {
    const sid = "schema_test";
    await initSession(sid, "m", { platform: "parlor" });
    await updateSessionMetaField(sid, { acp_sessions: { cursor: "uuid-1" } });
    const meta = await loadSessionMeta(sid);
    expect(meta.role).toBe("session_meta");
    if (meta.role !== "session_meta") return;
    expect(meta.acp_sessions).toEqual({ cursor: "uuid-1" });
  });
});

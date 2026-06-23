import { describe, it, expect } from "bun:test";
import { buildAcpCallbackPrompt, createAcpSessionUpdatedHandler } from "./acp-session-callback.ts";

describe("buildAcpCallbackPrompt", () => {
  it("includes acp_session_id per task", () => {
    const prompt = buildAcpCallbackPrompt([
      {
        acp_session_id: "acp-1",
        status: "completed",
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(prompt).toContain("acp-1");
    expect(prompt).toContain("t1");
  });
});

describe("createAcpSessionUpdatedHandler recheck", () => {
  it("schedules recheck when notify arrives during inflight", async () => {
    let sendCount = 0;
    let handledAt = "";
    let readCount = 0;

    const handler = createAcpSessionUpdatedHandler({
      conversation: {
        loadSessionMeta: async () => {
          readCount++;
          const tasks =
            readCount === 1
              ? {
                  "acp-1": {
                    status: "completed" as const,
                    task_id: "t1",
                    agent_name: "cursor",
                    updated_at: "2026-06-01T00:00:00.000Z",
                  },
                }
              : {
                  "acp-1": {
                    status: "completed" as const,
                    task_id: "t1",
                    agent_name: "cursor",
                    updated_at: "2026-06-01T00:00:00.000Z",
                  },
                  "acp-2": {
                    status: "completed" as const,
                    task_id: "t2",
                    agent_name: "cursor",
                    updated_at: "2026-06-01T00:00:01.000Z",
                  },
                };
          return {
            role: "session_meta" as const,
            model: "m",
            cached_toolsets: [],
            functions: [],
            timestamp: "",
            platform: "chat",
            acp_tasks: tasks,
            acp_tasks_handled_at: handledAt,
          };
        },
        updateSessionMetaField: async (_sid: string, patch: Record<string, unknown>) => {
          if (typeof patch.acp_tasks_handled_at === "string") {
            handledAt = patch.acp_tasks_handled_at;
          }
        },
      } as never,
      getRuntime: () =>
        ({
          sendMessage: async () => {
            sendCount++;
            await new Promise((r) => setTimeout(r, 80));
            return { session_id: "s", content: "ok" };
          },
        }) as never,
    });

    handler("sess");
    await new Promise((r) => setTimeout(r, 10));
    handler("sess");
    await new Promise((r) => setTimeout(r, 900));
    expect(sendCount).toBe(2);
  });
});

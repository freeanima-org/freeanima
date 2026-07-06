import { describe, it, expect } from "bun:test";
import { AcpAsyncTaskStore } from "./async-task.ts";
import {
  findAcpTaskByTaskId,
  findLatestAcpTaskEntry,
  normalizeAcpTaskViewStatus,
  queryAcpTaskStatus,
} from "./task-status.ts";
import type { AcpTasksMeta } from "./acp-tasks.ts";

describe("normalizeAcpTaskViewStatus", () => {
  it("maps terminal error states to failed", () => {
    expect(normalizeAcpTaskViewStatus("error")).toBe("failed");
    expect(normalizeAcpTaskViewStatus("cancelled")).toBe("failed");
    expect(normalizeAcpTaskViewStatus("timed_out")).toBe("failed");
  });
});

describe("findAcpTaskByTaskId / findLatestAcpTaskEntry", () => {
  const tasks: AcpTasksMeta = {
    s1: {
      status: "completed",
      task_id: "t1",
      agent_name: "cursor",
      updated_at: "2026-06-11T10:00:00.000Z",
    },
    s2: {
      status: "running",
      task_id: "t2",
      agent_name: "cursor",
      updated_at: "2026-06-11T11:00:00.000Z",
    },
  };

  it("finds by task_id", () => {
    expect(findAcpTaskByTaskId(tasks, "t2")?.acpSessionId).toBe("s2");
  });

  it("finds latest by updated_at", () => {
    expect(findLatestAcpTaskEntry(tasks)?.entry.task_id).toBe("t2");
  });
});

describe("queryAcpTaskStatus", () => {
  it("returns in-memory running task with progress", async () => {
    const store = new AcpAsyncTaskStore();
    const now = Date.now();
    store.set({
      taskId: "mem-1",
      agentName: "cursor",
      acpSessionId: "acp-1",
      animaSessionId: "sess-1",
      mode: "agent",
      status: "running",
      startedAt: now - 90_000,
      lastProgressAt: now,
      progressNotes: ["line one", "line two"],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });

    const conversation = {
      loadConversationMeta: async () => ({
        role: "conversation_meta" as const,
        model: "test",
        cached_toolsets: [],
        functions: [],
        timestamp: "",
        acp_tasks: {
          "acp-1": {
            status: "running" as const,
            task_id: "mem-1",
            agent_name: "cursor",
            updated_at: "2026-06-11T12:00:00.000Z",
          },
        },
      }),
      updateConversationMetaField: async () => {},
    };

    const view = await queryAcpTaskStatus({
      conversation,
      taskStore: store,
      animaSessionId: "sess-1",
    });

    expect(view?.task_id).toBe("mem-1");
    expect(view?.status).toBe("running");
    expect(view?.progress_text).toContain("line two");
    expect(view?.elapsed).toBe("1m30s");
  });

  it("returns meta task with persisted progress text", async () => {
    const store = new AcpAsyncTaskStore();
    const conversation = {
      loadConversationMeta: async () => ({
        role: "conversation_meta" as const,
        model: "test",
        cached_toolsets: [],
        functions: [],
        timestamp: "",
        acp_tasks: {
          "acp-9": {
            status: "completed" as const,
            task_id: "done-1",
            agent_name: "cursor",
            updated_at: "2026-06-11T12:00:00.000Z",
            progress_message_id: "msg-9",
          },
        },
      }),
      updateConversationMetaField: async () => {},
    };

    const view = await queryAcpTaskStatus({
      conversation,
      taskStore: store,
      taskQuery: {
        getMessageContent: async () => "stored progress tail",
        findAcpResultForTask: async () => ({
          conversation_id: "acp-9",
          output: "final output",
          new_session: false,
          reused_binding: false,
          explicit_session: false,
          mode: "agent",
        }),
      },
      animaSessionId: "sess-1",
      taskId: "done-1",
    });

    expect(view?.status).toBe("completed");
    expect(view?.progress_text).toBe("stored progress tail");
    expect(view?.result?.output).toBe("final output");
  });
});

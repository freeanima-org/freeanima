import { describe, expect, it } from "bun:test";
import type { SessionStorePort } from "@freeanima/engine-repos";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { runWithToolContext } from "@freeanima/engine-loop";
import { registerSessionTools } from "./sessions-tools.ts";

function createMockSessionStore(overrides: Partial<SessionStorePort> = {}): SessionStorePort {
  const base: SessionStorePort = {
    async getSessionMeta() {
      return null;
    },
    async getSessionMetaLite() {
      return null;
    },
    async getSessionTools() {
      return [];
    },
    async upsertSessionMeta() {},
    async patchSessionMeta() {},
    async updateCompression() {},
    async updateTodos() {},
    async appendMessage() {
      throw new Error("not implemented");
    },
    async nextMessagePos() {
      return 1;
    },
    async listMessages() {
      return [];
    },
    async listMessagesByPosRange() {
      return [];
    },
    async listMessagesPage() {
      return [];
    },
    async countMessages() {
      return 0;
    },
    async findMessagePos() {
      return null;
    },
    async listMessageRowsPage() {
      return [];
    },
    async listMessageRowsFromPos() {
      return [];
    },
    async lastMessageTimestamp() {
      return null;
    },
    async truncateMessagesAfter() {},
    async shiftMessagePositions() {},
    async sessionExists() {
      return false;
    },
    async deleteSession() {},
    async listSessionIds() {
      return [];
    },
    async listDebugSessionIds() {
      return [];
    },
    async listSessionSummaries() {
      return [];
    },
    async countSessionsByPlatform() {
      return {};
    },
    async deleteDebugSessions() {
      return 0;
    },
    async findSessionIdByPlatformInfo() {
      return null;
    },
    async searchMessagesFts() {
      return [];
    },
    async countSearchableMessages() {
      return 0;
    },
    async listSessionIdsUpdatedBetween() {
      return [];
    },
  };
  return { ...base, ...overrides };
}

function reposWithSession(session: SessionStorePort) {
  return { ...nullPgRepositories, session };
}

describe("registerSessionTools", () => {
  it("sessions_search 返回 FTS 命中", async () => {
    const toolSets = new ToolSetRegistry();
    registerSessionTools(toolSets);
    const def = toolSets.getTool("sessions_search");
    expect(def).toBeDefined();

    const session = createMockSessionStore({
      async searchMessagesFts() {
        return [
          {
            message_id: "m1",
            session_id: "s1",
            role: "user",
            content: "hello world",
            timestamp: "2026-01-01T00:00:00+08:00",
            rank: 0.5,
          },
        ];
      },
    });

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ query: "hello" });
        const parsed = JSON.parse(raw) as {
          hits: { message_id: string; content: string }[];
        };
        expect(parsed.hits).toHaveLength(1);
        expect(parsed.hits[0]!.message_id).toBe("m1");
        expect(parsed.hits[0]!.content).toBe("hello world");
      },
      { tools: toolSets, repos: reposWithSession(session) },
    );
  });

  it("sessions_search 缺少 query 返回 error", async () => {
    const toolSets = new ToolSetRegistry();
    registerSessionTools(toolSets);
    const def = toolSets.getTool("sessions_search")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ query: "  " });
        expect(raw).toContain('"error"');
      },
      { tools: toolSets, repos: reposWithSession(createMockSessionStore()) },
    );
  });

  it("sessions_scroll 按 offset 分页", async () => {
    const toolSets = new ToolSetRegistry();
    registerSessionTools(toolSets);
    const def = toolSets.getTool("sessions_scroll")!;

    const session = createMockSessionStore({
      async sessionExists(id: string) {
        return id === "s1";
      },
      async countMessages() {
        return 5;
      },
      async listMessageRowsPage(_sid, offset, limit) {
        return [
          {
            message_id: "m2",
            pos: offset + 2,
            role: "assistant",
            content: "reply",
            timestamp: "2026-01-01T00:00:01+08:00",
          },
        ].slice(0, limit);
      },
    });

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ session_id: "s1", offset: 1, limit: 10 });
        const parsed = JSON.parse(raw) as {
          session_id: string;
          messages: { message_id: string; content: string }[];
          total: number;
          offset: number;
        };
        expect(parsed.session_id).toBe("s1");
        expect(parsed.total).toBe(5);
        expect(parsed.offset).toBe(1);
        expect(parsed.messages[0]!.message_id).toBe("m2");
      },
      { tools: toolSets, repos: reposWithSession(session) },
    );
  });

  it("sessions_scroll 按 message_id 锚点", async () => {
    const toolSets = new ToolSetRegistry();
    registerSessionTools(toolSets);
    const def = toolSets.getTool("sessions_scroll")!;

    const session = createMockSessionStore({
      async sessionExists() {
        return true;
      },
      async countMessages() {
        return 3;
      },
      async findMessagePos(_sid, messageId) {
        return messageId === "anchor" ? 2 : null;
      },
      async listMessageRowsFromPos(_sid, fromPos, limit) {
        return [
          {
            message_id: "anchor",
            pos: fromPos,
            role: "user",
            content: "anchor text",
            timestamp: "2026-01-01T00:00:00+08:00",
          },
        ].slice(0, limit);
      },
    });

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ session_id: "s1", message_id: "anchor" });
        const parsed = JSON.parse(raw) as {
          messages: { message_id: string; content: string }[];
          offset: number;
        };
        expect(parsed.messages[0]!.message_id).toBe("anchor");
        expect(parsed.offset).toBe(1);
      },
      { tools: toolSets, repos: reposWithSession(session) },
    );
  });

  it("sessions_scroll session 不存在返回 error", async () => {
    const toolSets = new ToolSetRegistry();
    registerSessionTools(toolSets);
    const def = toolSets.getTool("sessions_scroll")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ session_id: "missing" });
        expect(raw).toContain('"error"');
        expect(raw).toContain("not found");
      },
      { tools: toolSets, repos: reposWithSession(createMockSessionStore()) },
    );
  });
});

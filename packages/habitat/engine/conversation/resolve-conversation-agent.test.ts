import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const getEntityMock = mock(async (_id: number): Promise<unknown> => null);
const getConversationMetaMock = mock(async (_id: string): Promise<unknown> => null);
const resolvePrivateWorldIdMock = mock(async (id: number) => id * 100);

const entityOriginal = await import("@freeanima/habitat/core/db/pg/entity");
const conversationOriginal = await import("@freeanima/habitat/core/db/pg/conversation");
const worldContextPgOriginal = await import("@freeanima/habitat/core/config/world-context-pg.ts");

mock.module("@freeanima/habitat/core/db/pg/entity", () => ({
  ...entityOriginal,
  getEntity: getEntityMock,
  listEntities: mock(async () => []),
}));
mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  getConversationMeta: getConversationMetaMock,
}));
mock.module("@freeanima/habitat/core/config/world-context-pg.ts", () => ({
  ...worldContextPgOriginal,
  resolvePrivateWorldId: resolvePrivateWorldIdMock,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/entity", () => entityOriginal);
  mock.module("@freeanima/habitat/core/db/pg/conversation", () => conversationOriginal);
  mock.module("@freeanima/habitat/core/config/world-context-pg.ts", () => worldContextPgOriginal);
});

const { resolveBoundAgentFromMeta, resolveBoundAgentForConversation, assertBindableAgentSubject } =
  await import("./resolve-conversation-agent.ts");

describe("resolveBoundAgent", () => {
  beforeEach(() => {
    getEntityMock.mockClear();
    getConversationMetaMock.mockClear();
    resolvePrivateWorldIdMock.mockClear();
    getEntityMock.mockImplementation(async (id: number) => ({
      id,
      type: "agent",
      title: `Agent ${id}`,
      body: { enabled: true },
    }));
  });

  it("resolveBoundAgentFromMeta uses agent_subject_id → private world", async () => {
    const bound = await resolveBoundAgentFromMeta({
      agent_subject_id: 7,
    } as never);
    expect(bound.agent_subject_id).toBe(7);
    expect(bound.agent_world_id).toBe(700);
    expect(resolvePrivateWorldIdMock).toHaveBeenCalledWith(7);
  });

  it("resolveBoundAgentFromMeta rejects missing agent_subject_id", async () => {
    await expect(resolveBoundAgentFromMeta({} as never)).rejects.toThrow(
      /missing agent_subject_id/,
    );
  });

  it("resolveBoundAgentForConversation loads meta then binds", async () => {
    getConversationMetaMock.mockImplementation(async () => ({
      model: "x",
      agent_subject_id: 3,
    }));
    const bound = await resolveBoundAgentForConversation("c1");
    expect(bound).toEqual({
      agent_subject_id: 3,
      agent_world_id: 300,
      title: "Agent 3",
    });
  });

  it("assertBindableAgentSubject rejects non-agent", async () => {
    getEntityMock.mockImplementation(async () => ({
      id: 9,
      type: "user",
      title: "u",
      body: {},
    }));
    await expect(assertBindableAgentSubject(9)).rejects.toThrow(/not found/);
  });
});

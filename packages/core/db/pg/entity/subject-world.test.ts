import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * ensureWorldSubjects：唯一 user + 至少一个 agent + Commons；默认聊天 agent 来自 chat 段。
 * mock entity crud，避免真实 PG。
 */

type Row = { id: number; type: string; body: Record<string, unknown>; title: string };

const store = {
  rows: [] as Row[],
};

const getEntity = mock(async (id: number) => store.rows.find((r) => r.id === id) ?? null);
const listEntities = mock(async (opts?: { type?: string; limit?: number }) => {
  const filtered = opts?.type ? store.rows.filter((r) => r.type === opts.type) : store.rows;
  const limit = opts?.limit ?? filtered.length;
  return filtered.slice(0, limit);
});
const listCommonWorldEntities = mock(async () =>
  store.rows.filter((r) => r.type === "world" && r.body.common === true),
);
const createEntity = mock(async (input: { type: string; title?: string }) => {
  const id = 100 + createEntity.mock.calls.length;
  const row: Row = {
    id,
    type: input.type,
    body: {},
    title: input.title ?? (input.type === "user" ? "用户" : "Agent"),
  };
  store.rows.push(row);
  return row;
});
const createEntityAtId = mock(async (input: { id: number; type: string }) => {
  const row: Row = {
    id: input.id,
    type: input.type,
    body: {},
    title: input.type === "user" ? "用户" : "Agent",
  };
  store.rows.push(row);
  return row;
});
const updateEntity = mock(
  async (input: {
    id: number;
    body?: Record<string, unknown>;
    world_id?: number;
    title?: string;
  }) => {
    const idx = store.rows.findIndex((r) => r.id === input.id);
    const prev = idx >= 0 ? store.rows[idx]! : { id: input.id, type: "user", body: {}, title: "" };
    const next: Row = {
      ...prev,
      body: input.body ?? prev.body,
      ...(input.title != null ? { title: input.title } : {}),
      ...(input.world_id != null ? { type: "world" } : {}),
    };
    if (idx >= 0) store.rows[idx] = next;
    else store.rows.push(next);
    return next;
  },
);

const entityCrudOriginal = await import("./repos/entity-crud-repo.ts");
const worldAssertOriginal = await import("./world-assert.ts");

mock.module("./repos/entity-crud-repo.ts", () => ({
  ...entityCrudOriginal,
  getEntity,
  listEntities,
  listCommonWorldEntities,
  createEntity,
  createEntityAtId,
  updateEntity,
}));

mock.module("./world-assert.ts", () => ({
  ...worldAssertOriginal,
  assertPrivateWorldOwnedBySubject: mock(async () => undefined),
}));

afterAll(() => {
  mock.module("./repos/entity-crud-repo.ts", () => entityCrudOriginal);
  mock.module("./world-assert.ts", () => worldAssertOriginal);
});

const { ensureWorldSubjects } = await import("./subject-world.ts");

describe("ensureWorldSubjects", () => {
  beforeEach(() => {
    store.rows = [];
    getEntity.mockClear();
    listEntities.mockClear();
    listCommonWorldEntities.mockClear();
    createEntity.mockClear();
    createEntityAtId.mockClear();
    updateEntity.mockClear();
  });

  it("creates next-id subjects when unconfigured and empty", async () => {
    const ctx = await ensureWorldSubjects({});
    expect(createEntityAtId).not.toHaveBeenCalled();
    expect(createEntity.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(ctx.user_subject_id).toBeGreaterThan(0);
    expect(ctx.default_chat_agent_subject_id).toBeGreaterThan(0);
    expect(ctx.user_world_id).toBeGreaterThan(0);
    expect(ctx.default_chat_agent_world_id).toBeGreaterThan(0);
    expect(ctx.agent_subject_id).toBe(ctx.default_chat_agent_subject_id);
    expect(ctx.agent_world_id).toBe(ctx.default_chat_agent_world_id);
    expect(ctx.commons_world_id).toBeGreaterThan(0);
  });

  it("discovers lowest-id existing subjects when unconfigured", async () => {
    store.rows = [
      { id: 42, type: "user", body: { default_private_world_id: 420 }, title: "用户" },
      { id: 43, type: "agent", body: { default_private_world_id: 430 }, title: "Agent" },
      {
        id: 900,
        type: "world",
        body: { private: false, common: true, grants: [] },
        title: "Commons",
      },
    ];

    const ctx = await ensureWorldSubjects({});
    expect(createEntity).not.toHaveBeenCalled();
    expect(createEntityAtId).not.toHaveBeenCalled();
    expect(ctx).toEqual({
      user_subject_id: 42,
      agent_subject_id: 43,
      user_world_id: 420,
      agent_world_id: 430,
      default_chat_agent_subject_id: 43,
      default_chat_agent_world_id: 430,
      commons_world_id: 900,
    });
  });

  it("picks chat.default_agent_subject_id when multiple agents exist", async () => {
    store.rows = [
      { id: 1, type: "user", body: { default_private_world_id: 10 }, title: "用户" },
      { id: 5, type: "agent", body: { default_private_world_id: 50, enabled: true }, title: "A" },
      { id: 6, type: "agent", body: { default_private_world_id: 60, enabled: true }, title: "B" },
      {
        id: 900,
        type: "world",
        body: { private: false, common: true, grants: [] },
        title: "Commons",
      },
    ];

    const ctx = await ensureWorldSubjects({
      chat: { default_agent_subject_id: 6 },
    });

    expect(createEntityAtId).not.toHaveBeenCalled();
    expect(ctx.default_chat_agent_subject_id).toBe(6);
    expect(ctx.default_chat_agent_world_id).toBe(60);
    expect(ctx.user_subject_id).toBe(1);
  });
});

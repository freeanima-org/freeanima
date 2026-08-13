import { beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * ensureWorldSubjects 路径：配置优先 / 发现 / next-id 创建。
 * mock entity crud，避免真实 PG。
 */

const getEntity = mock(
  async (_id: number) =>
    null as null | { id: number; type: string; body: Record<string, unknown>; title: string },
);
const listEntities = mock(
  async (_opts?: { type?: string; limit?: number }) =>
    [] as Array<{ id: number; type: string; body: Record<string, unknown>; title: string }>,
);
const createEntity = mock(async (input: { type: string }) => {
  const id = createEntity.mock.calls.length + 100;
  return {
    id,
    type: input.type,
    body: {},
    title: input.type === "user" ? "用户" : "Agent",
  };
});
const createEntityAtId = mock(async (input: { id: number; type: string }) => ({
  id: input.id,
  type: input.type,
  body: {},
  title: input.type === "user" ? "用户" : "Agent",
}));
const updateEntity = mock(
  async (input: { id: number; body?: Record<string, unknown>; world_id?: number }) => ({
    id: input.id,
    type: "world",
    body: input.body ?? {},
    title: "",
    ...(input.world_id != null ? { world_id: input.world_id } : {}),
  }),
);

mock.module("./repos/entity-crud-repo.ts", () => ({
  getEntity,
  listEntities,
  createEntity,
  createEntityAtId,
  updateEntity,
}));

mock.module("./world-assert.ts", () => ({
  assertPrivateWorldOwnedBySubject: mock(async () => undefined),
}));

const { ensureWorldSubjects } = await import("./subject-world.ts");

describe("ensureWorldSubjects", () => {
  beforeEach(() => {
    getEntity.mockReset();
    listEntities.mockReset();
    createEntity.mockReset();
    createEntityAtId.mockReset();
    updateEntity.mockReset();

    getEntity.mockImplementation(async (id: number) => {
      // after create / update, return subject with default world
      if (id >= 100) {
        return {
          id,
          type: id % 2 === 0 ? "agent" : "user",
          body: { default_private_world_id: id + 1000 },
          title: "x",
        };
      }
      return null;
    });
    listEntities.mockImplementation(async () => []);
    createEntity.mockImplementation(async (input: { type: string }) => {
      const id = 100 + createEntity.mock.calls.length;
      return {
        id,
        type: input.type,
        body: {},
        title: input.type === "user" ? "用户" : "Agent",
      };
    });
    updateEntity.mockImplementation(
      async (input: { id: number; body?: Record<string, unknown>; world_id?: number }) => ({
        id: input.id,
        type: input.world_id != null ? "world" : "user",
        body: input.body ?? { default_private_world_id: input.id + 1000 },
        title: "",
      }),
    );
  });

  it("creates next-id subjects when unconfigured and empty", async () => {
    const ctx = await ensureWorldSubjects({});
    expect(createEntityAtId).not.toHaveBeenCalled();
    expect(createEntity.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(ctx.user_subject_id).toBeGreaterThan(0);
    expect(ctx.agent_subject_id).toBeGreaterThan(0);
    expect(ctx.user_world_id).toBeGreaterThan(0);
    expect(ctx.agent_world_id).toBeGreaterThan(0);
  });

  it("discovers lowest-id existing subjects when unconfigured", async () => {
    listEntities.mockImplementation(async (opts?: { type?: string }) => {
      if (opts?.type === "user") {
        return [{ id: 42, type: "user", body: { default_private_world_id: 420 }, title: "用户" }];
      }
      if (opts?.type === "agent") {
        return [{ id: 43, type: "agent", body: { default_private_world_id: 430 }, title: "Agent" }];
      }
      if (opts?.type === "world") {
        return [
          {
            id: 900,
            type: "world",
            body: { private: false, common: true, grants: [] },
            title: "Commons",
          },
        ];
      }
      return [];
    });
    getEntity.mockImplementation(async (id: number) => {
      if (id === 42) {
        return { id: 42, type: "user", body: { default_private_world_id: 420 }, title: "用户" };
      }
      if (id === 43) {
        return { id: 43, type: "agent", body: { default_private_world_id: 430 }, title: "Agent" };
      }
      return null;
    });

    const ctx = await ensureWorldSubjects({});
    expect(createEntity).not.toHaveBeenCalled();
    expect(createEntityAtId).not.toHaveBeenCalled();
    expect(ctx).toEqual({
      user_subject_id: 42,
      agent_subject_id: 43,
      user_world_id: 420,
      agent_world_id: 430,
      commons_world_id: 900,
    });
  });

  it("ensures configured ids via createEntityAtId when missing", async () => {
    createEntityAtId.mockImplementation(async (input: { id: number; type: string }) => ({
      id: input.id,
      type: input.type,
      body: {},
      title: input.type === "user" ? "用户" : "Agent",
    }));
    getEntity.mockImplementation(async (id: number) => {
      // first lookups miss; after createAtId + world bootstrap, return with world
      const created = createEntityAtId.mock.calls.some((c) => (c[0] as { id: number }).id === id);
      if (created) {
        return {
          id,
          type: id === 5 ? "user" : "agent",
          body: { default_private_world_id: id * 10 },
          title: "x",
        };
      }
      return null;
    });

    const ctx = await ensureWorldSubjects({
      worlds: { user_subject_id: 5, agent_subject_id: 6 },
    });

    expect(createEntityAtId).toHaveBeenCalled();
    expect(ctx.user_subject_id).toBe(5);
    expect(ctx.agent_subject_id).toBe(6);
  });
});

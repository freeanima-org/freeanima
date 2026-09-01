import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/resolved-world-context.ts";
import type { EntityRow } from "@freeanima/habitat/core/db/pg/entity";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";

import type { RuntimeDeps } from "./runtime-deps.ts";

const getEntityMock = mock(
  async (_id: number, _opts?: { include_deleted?: boolean }) => null as EntityRow | null,
);
const assertSubjectCanAccessWorldMock = mock(async () => undefined);
const listEntitiesMock = mock(async () => [] as EntityRow[]);
const countEntitiesMock = mock(async () => 0);
const searchEntitiesMock = mock(async () => ({
  query: null as string | null,
  limit: 20,
  offset: 0,
  count: 0,
  results: [] as EntityRow[],
}));
const addEntityComponentMock = mock(
  async (_input: {
    id: number;
    component: string;
    body: Record<string, unknown>;
    promote_primary?: boolean;
  }) => null as EntityRow | null,
);
const promoteEntityComponentMock = mock(
  async (_input: { id: number; component: string }) => null as EntityRow | null,
);
const deleteEntityComponentMock = mock(
  async (_id: number, _component: string) => null as EntityRow | null,
);

// 先捕获真实实现，mock 后在 afterAll 恢复，避免 mock.module 全局泄漏污染其他测试文件。
const realPg = await import("@freeanima/habitat/core/db/pg");
const pgOriginal = { ...realPg };
const realWorldContext = await import("@freeanima/habitat/core/config/world-context-pg");
const worldContextOriginal = { ...realWorldContext };
const realEntity = await import("@freeanima/habitat/core/db/pg/entity");
const entityOriginal = { ...realEntity };

mock.module("@freeanima/habitat/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/config/world-context-pg", () => ({
  ...worldContextOriginal,
  resolvePrivateWorldId: async (subjectId: number) => (subjectId === 2 ? 20 : 10),
}));

mock.module("@freeanima/habitat/core/db/pg/entity", () => ({
  ...entityOriginal,
  getEntity: getEntityMock,
  assertSubjectCanAccessWorld: assertSubjectCanAccessWorldMock,
  listEntities: listEntitiesMock,
  countEntities: countEntitiesMock,
  searchEntities: searchEntitiesMock,
  collectEntityReferences: async () => [],
  deleteEntity: async () => true,
  restoreEntity: async () => null,
  deleteEntityComponent: deleteEntityComponentMock,
  addEntityComponent: addEntityComponentMock,
  promoteEntityComponent: promoteEntityComponentMock,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg", () => pgOriginal);
  mock.module("@freeanima/habitat/core/config/world-context", () => worldContextOriginal);
  mock.module("@freeanima/habitat/core/db/pg/entity", () => entityOriginal);
});

import {
  serviceEntityAddComponent,
  serviceEntityGet,
  serviceEntityList,
  serviceEntitySetPrimaryComponent,
  serviceEntityTrashList,
} from "./service.ts";

function auth(): VerifiedServiceApiToken {
  return { subject_id: 1, subject_type: "user" } as VerifiedServiceApiToken;
}

function testDeps(): RuntimeDeps {
  return {};
}

function bindWorlds() {
  bindResolvedWorldContext({
    user_subject_id: 1,
    agent_subject_id: 2,
    user_world_id: 10,
    agent_world_id: 20,
    commons_world_id: 30,
    default_chat_agent_subject_id: 2,
    default_chat_agent_world_id: 20,
  });
}

function row(partial: Partial<EntityRow> & Pick<EntityRow, "id">): EntityRow {
  return {
    id: partial.id,
    type: partial.type ?? "content",
    title: partial.title ?? "t",
    summary: partial.summary ?? "",
    content: partial.content ?? "",
    primary_component: partial.primary_component ?? "task_item",
    components: partial.components ?? ["task_item"],
    body: partial.body ?? {},
    client_op_id: partial.client_op_id ?? null,
    world_id: partial.world_id ?? 10,
    pinned: partial.pinned ?? false,
    reference_count: partial.reference_count ?? 0,
    tag_ids: partial.tag_ids ?? [],
    revisions: partial.revisions ?? [],
    created_at: partial.created_at ?? new Date("2026-01-01T00:00:00.000Z"),
    updated_at: partial.updated_at ?? new Date("2026-01-02T00:00:00.000Z"),
    deleted_at: partial.deleted_at ?? null,
  };
}

describe("serviceEntityList filters and search", () => {
  beforeEach(() => {
    getEntityMock.mockReset();
    listEntitiesMock.mockReset();
    countEntitiesMock.mockReset();
    searchEntitiesMock.mockReset();
    getEntityMock.mockImplementation(async () => null);
    listEntitiesMock.mockImplementation(async () => []);
    countEntitiesMock.mockImplementation(async () => 0);
    searchEntitiesMock.mockImplementation(async () => ({
      query: null,
      limit: 20,
      offset: 0,
      count: 0,
      results: [],
    }));
  });

  it("looks up by numeric id via getEntity", async () => {
    const hit = row({ id: 42, title: "exact" });
    getEntityMock.mockImplementation(async (id) => (id === 42 ? hit : null));

    const result = await serviceEntityList(testDeps(), { subject_id: 1, query: "42" }, auth());

    expect(result).toEqual({
      items: [
        {
          id: 42,
          type: "content",
          title: "exact",
          summary: "",
          primary_component: "task_item",
          components: ["task_item"],
          updated_at: "2026-01-02T00:00:00.000Z",
          deleted_at: null,
          world_id: 10,
        },
      ],
      count: 1,
    });
    expect(searchEntitiesMock).not.toHaveBeenCalled();
    expect(listEntitiesMock).not.toHaveBeenCalled();
  });

  it("fills list summary from content when title/summary empty", async () => {
    const hit = row({
      id: 11,
      title: "",
      summary: "",
      content: "记忆正文预览内容足够长",
      primary_component: "semantic_memory",
      components: ["semantic_memory"],
    });
    getEntityMock.mockImplementation(async () => hit);

    const result = await serviceEntityList(testDeps(), { subject_id: 1, query: "11" }, auth());
    expect(result.items[0]?.summary).toBe("记忆正文预览内容足够长");
  });

  it("returns empty for id hit that is soft-deleted on alive list", async () => {
    getEntityMock.mockImplementation(async () =>
      row({ id: 5, deleted_at: new Date("2026-02-01T00:00:00.000Z") }),
    );

    const result = await serviceEntityList(testDeps(), { subject_id: 1, query: "anima:5" }, auth());
    expect(result).toEqual({ items: [], count: 0 });
  });

  it("returns soft-deleted id hit on trash list", async () => {
    const deleted = row({
      id: 5,
      deleted_at: new Date("2026-02-01T00:00:00.000Z"),
    });
    getEntityMock.mockImplementation(async () => deleted);

    const result = await serviceEntityTrashList(
      testDeps(),
      { subject_id: 1, query: "anima:5" },
      auth(),
    );
    expect(result.count).toBe(1);
    expect(result.items[0]?.id).toBe(5);
    expect(result.items[0]?.deleted_at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("uses searchEntities for keyword queries", async () => {
    const hit = row({ id: 9, title: "notes" });
    searchEntitiesMock.mockImplementation(async () => ({
      query: "notes",
      limit: 20,
      offset: 0,
      count: 1,
      results: [hit],
    }));

    const result = await serviceEntityList(
      testDeps(),
      {
        subject_id: 1,
        query: "notes",
        type: "content",
        primary_component: "task_item",
        limit: 20,
        offset: 0,
      },
      auth(),
    );

    expect(result.count).toBe(1);
    expect(result.items[0]?.id).toBe(9);
    expect(searchEntitiesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 10,
        query: "notes",
        type: "content",
        primary_component: "task_item",
        deleted: "alive",
        mode: "hybrid",
        projection: "list",
      }),
    );
  });

  it("uses search snippet for list summary when content absent", async () => {
    const hit = {
      ...row({ id: 8, title: "", summary: "", content: "" }),
      snippet: "snippet from hybrid",
    };
    searchEntitiesMock.mockImplementation(async () => ({
      query: "hybrid",
      limit: 20,
      offset: 0,
      count: 1,
      results: [hit],
    }));

    const result = await serviceEntityList(testDeps(), { subject_id: 1, query: "hybrid" }, auth());
    expect(result.items[0]?.summary).toBe("snippet from hybrid");
  });

  it("passes type and primary_component to list and count together", async () => {
    const hit = row({ id: 3 });
    listEntitiesMock.mockImplementation(async () => [hit]);
    countEntitiesMock.mockImplementation(async () => 1);

    const result = await serviceEntityList(
      testDeps(),
      {
        subject_id: 1,
        type: "content",
        primary_component: "vault_item",
        limit: 20,
        offset: 0,
      },
      auth(),
    );

    expect(result.count).toBe(1);
    expect(listEntitiesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 10,
        deleted: "alive",
        type: "content",
        primary_component: "vault_item",
        order_by: "updated_at",
        order_dir: "desc",
      }),
    );
    expect(countEntitiesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 10,
        deleted: "alive",
        type: "content",
        primary_component: "vault_item",
      }),
    );
  });
});

describe("serviceEntityGet", () => {
  beforeEach(() => {
    bindWorlds();
    getEntityMock.mockReset();
    assertSubjectCanAccessWorldMock.mockReset();
    getEntityMock.mockImplementation(async () => null);
    assertSubjectCanAccessWorldMock.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("returns detail fields for entity in world", async () => {
    const hit = row({
      id: 42,
      title: "hello",
      summary: "sum",
      content: "body text",
      body: { a: 1 },
      revisions: [{ at: "x" } as never],
    });
    getEntityMock.mockImplementation(async () => hit);

    const result = await serviceEntityGet(testDeps(), { id: 42 }, auth());

    expect(result.item.id).toBe(42);
    expect(result.item.summary).toBe("sum");
    expect(result.item.content).toBe("body text");
    expect(result.item.body).toEqual({ a: 1 });
    expect(result.item.revision_count).toBe(1);
    expect(getEntityMock).toHaveBeenCalledWith(42, { include_deleted: false });
    expect(assertSubjectCanAccessWorldMock).toHaveBeenCalledWith(1, 10, { access: "read" });
  });

  it("user reading agent-world entity uses ACL", async () => {
    const hit = row({
      id: 99,
      world_id: 20,
      title: "",
      content: "agent memory",
      primary_component: "semantic_memory",
      components: ["semantic_memory"],
    });
    getEntityMock.mockImplementation(async () => hit);

    const result = await serviceEntityGet(testDeps(), { id: 99 }, auth());

    expect(result.item.id).toBe(99);
    expect(result.item.content).toBe("agent memory");
    expect(assertSubjectCanAccessWorldMock).toHaveBeenCalledWith(1, 20, { access: "read" });
  });

  it("agent token still uses ACL on agent world", async () => {
    const hit = row({ id: 88, world_id: 20 });
    getEntityMock.mockImplementation(async () => hit);

    await serviceEntityGet(testDeps(), { id: 88 }, {
      subject_id: 2,
      subject_type: "agent",
    } as VerifiedServiceApiToken);

    expect(assertSubjectCanAccessWorldMock).toHaveBeenCalledWith(2, 20, { access: "read" });
  });

  it("passes include_deleted for trash detail", async () => {
    const hit = row({
      id: 7,
      deleted_at: new Date("2026-02-01T00:00:00.000Z"),
    });
    getEntityMock.mockImplementation(async () => hit);

    await serviceEntityGet(testDeps(), { id: 7, include_deleted: true }, auth());

    expect(getEntityMock).toHaveBeenCalledWith(7, { include_deleted: true });
  });
});

describe("serviceEntityAddComponent / setPrimaryComponent", () => {
  beforeEach(() => {
    bindWorlds();
    getEntityMock.mockReset();
    addEntityComponentMock.mockReset();
    promoteEntityComponentMock.mockReset();
  });

  afterEach(() => {
    resetResolvedWorldContextForTest();
  });

  it("attaches without changing primary by default", async () => {
    const existing = row({
      id: 5,
      primary_component: "note",
      components: ["note"],
      body: {},
      client_op_id: null,
    });
    getEntityMock.mockImplementation(async () => existing);
    addEntityComponentMock.mockImplementation(
      async (input: {
        id: number;
        component: string;
        body: Record<string, unknown>;
        promote_primary?: boolean;
      }) =>
        row({
          id: 5,
          primary_component: "note",
          components: ["note", input.component],
          body: { ...existing.body, ...input.body },
        }),
    );

    const result = await serviceEntityAddComponent(
      testDeps(),
      {
        subject_id: 1,
        id: 5,
        component: "diary_entry",
        body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
      },
      auth(),
    );

    expect(result.item.primary_component).toBe("note");
    expect(result.item.components).toEqual(["note", "diary_entry"]);
    expect(addEntityComponentMock).toHaveBeenCalledWith({
      id: 5,
      component: "diary_entry",
      body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
    });
  });

  it("passes promote_primary when requested", async () => {
    const existing = row({
      id: 5,
      primary_component: "note",
      components: ["note"],
    });
    getEntityMock.mockImplementation(async () => existing);
    addEntityComponentMock.mockImplementation(async () =>
      row({
        id: 5,
        primary_component: "diary_entry",
        components: ["note", "diary_entry"],
      }),
    );

    await serviceEntityAddComponent(
      testDeps(),
      {
        subject_id: 1,
        id: 5,
        component: "diary_entry",
        body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
        promote_primary: true,
      },
      auth(),
    );

    expect(addEntityComponentMock).toHaveBeenCalledWith({
      id: 5,
      component: "diary_entry",
      body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
      promote_primary: true,
    });
  });

  it("rejects attach of identity component", async () => {
    getEntityMock.mockImplementation(async () =>
      row({ id: 5, primary_component: "note", components: ["note"] }),
    );
    await expect(
      serviceEntityAddComponent(
        testDeps(),
        { subject_id: 1, id: 5, component: "agent_config", body: {} },
        auth(),
      ),
    ).rejects.toThrow(/identity/);
    expect(addEntityComponentMock).not.toHaveBeenCalled();
  });

  it("rejects attach on non-content", async () => {
    getEntityMock.mockImplementation(async () =>
      row({
        id: 5,
        type: "world",
        primary_component: "world_config",
        components: ["world_config"],
      }),
    );
    await expect(
      serviceEntityAddComponent(
        testDeps(),
        { subject_id: 1, id: 5, component: "note", body: {} },
        auth(),
      ),
    ).rejects.toThrow(/content/);
  });

  it("promotes secondary component", async () => {
    const existing = row({
      id: 5,
      primary_component: "note",
      components: ["note", "diary_entry"],
      body: { entry_at: "2026-08-19T00:00:00.000+08:00" },
      client_op_id: "x",
    });
    getEntityMock.mockImplementation(async () => existing);
    promoteEntityComponentMock.mockImplementation(async () =>
      row({
        id: 5,
        primary_component: "diary_entry",
        components: ["note", "diary_entry"],
        body: existing.body,
      }),
    );

    const result = await serviceEntitySetPrimaryComponent(
      testDeps(),
      { subject_id: 1, id: 5, component: "diary_entry" },
      auth(),
    );

    expect(result.item.primary_component).toBe("diary_entry");
    expect(result.item.components).toEqual(["note", "diary_entry"]);
    expect(promoteEntityComponentMock).toHaveBeenCalledWith({ id: 5, component: "diary_entry" });
  });
});

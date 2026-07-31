import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { EntityRow } from "@freeanima/host/core/db/pg/entity";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";

import type { RuntimeDeps } from "./runtime-deps.ts";

const getEntityMock = mock(
  async (_id: number, _opts?: { include_deleted?: boolean }) => null as EntityRow | null,
);
const listEntitiesMock = mock(async () => [] as EntityRow[]);
const countEntitiesMock = mock(async () => 0);
const searchEntitiesMock = mock(async () => ({
  query: null as string | null,
  limit: 20,
  offset: 0,
  count: 0,
  results: [] as EntityRow[],
}));

mock.module("@freeanima/host/core/db/pg", () => ({
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/host/core/config/world-context", () => ({
  resolveSubjectWorldId: async () => 10,
}));

mock.module("@freeanima/host/core/db/pg/entity", () => ({
  getEntity: getEntityMock,
  listEntities: listEntitiesMock,
  countEntities: countEntitiesMock,
  searchEntities: searchEntitiesMock,
  collectEntityReferences: async () => [],
  deleteEntity: async () => true,
  restoreEntity: async () => null,
  deleteEntityComponent: async () => null,
}));

import { serviceEntityList, serviceEntityTrashList } from "./service.ts";

function auth(): VerifiedServiceApiToken {
  return { subject_type: "user" } as VerifiedServiceApiToken;
}

function testDeps(): RuntimeDeps {
  return {};
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

    const result = await serviceEntityList(
      testDeps(),
      { subject_kind: "user", query: "42" },
      auth(),
    );

    expect(result).toEqual({
      items: [
        {
          id: 42,
          type: "content",
          title: "exact",
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

  it("returns empty for id hit that is soft-deleted on alive list", async () => {
    getEntityMock.mockImplementation(async () =>
      row({ id: 5, deleted_at: new Date("2026-02-01T00:00:00.000Z") }),
    );

    const result = await serviceEntityList(
      testDeps(),
      { subject_kind: "user", query: "anima:5" },
      auth(),
    );
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
      { subject_kind: "user", query: "anima:5" },
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
        subject_kind: "user",
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

  it("passes type and primary_component to list and count together", async () => {
    const hit = row({ id: 3 });
    listEntitiesMock.mockImplementation(async () => [hit]);
    countEntitiesMock.mockImplementation(async () => 1);

    const result = await serviceEntityList(
      testDeps(),
      {
        subject_kind: "user",
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

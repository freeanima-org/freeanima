import { afterAll, describe, expect, it, mock } from "bun:test";

const getEntity = mock(
  async (_id: number) => null as null | { id: number; type: string; body: Record<string, unknown> },
);

const entityCrudOriginal = await import("./repos/entity-crud-repo.ts");

mock.module("./repos/entity-crud-repo.ts", () => ({
  ...entityCrudOriginal,
  getEntity,
}));

afterAll(() => {
  mock.module("./repos/entity-crud-repo.ts", () => entityCrudOriginal);
});

const { getSubjectWorldAccessLevel, ToolWorldAccessError } = await import("./tool-world-access.ts");

describe("getSubjectWorldAccessLevel", () => {
  it("gives type=user write on any world without grants", async () => {
    getEntity.mockImplementation(async (id: number) => {
      if (id === 1) return { id: 1, type: "user", body: {} };
      if (id === 99) {
        return {
          id: 99,
          type: "world",
          body: { private: true, owner_subject_id: 2, grants: [] },
        };
      }
      return null;
    });
    await expect(getSubjectWorldAccessLevel(1, 99)).resolves.toBe("write");
  });

  it("still enforces grants for agent on private world", async () => {
    getEntity.mockImplementation(async (id: number) => {
      if (id === 2) return { id: 2, type: "agent", body: {} };
      if (id === 99) {
        return {
          id: 99,
          type: "world",
          body: { private: true, owner_subject_id: 3, grants: [] },
        };
      }
      return null;
    });
    await expect(getSubjectWorldAccessLevel(2, 99)).resolves.toBe("none");
  });

  it("throws when world missing for non-user", async () => {
    getEntity.mockImplementation(async (id: number) => {
      if (id === 2) return { id: 2, type: "agent", body: {} };
      return null;
    });
    await expect(getSubjectWorldAccessLevel(2, 404)).rejects.toBeInstanceOf(ToolWorldAccessError);
  });
});

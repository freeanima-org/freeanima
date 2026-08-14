import { describe, expect, test } from "bun:test";

import {
  buildCreatePublicProjectWorldInput,
  extractStableKeyFromWorldBody,
  findWorldByStableKey,
  resolveProjectWorldId,
} from "./resolve-project-world.ts";

describe("resolve-project-world", () => {
  test("extractStableKeyFromWorldBody", () => {
    expect(extractStableKeyFromWorldBody({ stable_key: " git:a/b " })).toBe("git:a/b");
    expect(extractStableKeyFromWorldBody({})).toBeNull();
  });

  test("findWorldByStableKey", () => {
    const worlds = [
      { id: 1, body: { stable_key: "git:other/x" } },
      { id: 2, body: { stable_key: "git:org/demo" } },
    ];
    expect(findWorldByStableKey(worlds, "git:org/demo")?.id).toBe(2);
    expect(findWorldByStableKey(worlds, "missing")).toBeNull();
  });

  test("buildCreatePublicProjectWorldInput", () => {
    expect(
      buildCreatePublicProjectWorldInput({
        stable_key: "git:org/demo",
        title: "Demo",
      }),
    ).toEqual({
      title: "Demo",
      summary: "",
      private: false,
      stable_key: "git:org/demo",
    });
  });

  test("resolveProjectWorldId 命中已有", async () => {
    const r = await resolveProjectWorldId({
      stable_key: "git:org/demo",
      listWorlds: async () => [{ id: 9, body: { stable_key: "git:org/demo" } }],
      createWorld: async () => {
        throw new Error("不应创建");
      },
    });
    expect(r).toEqual({ world_id: 9, created: false });
  });

  test("resolveProjectWorldId 未命中则创建", async () => {
    const r = await resolveProjectWorldId({
      stable_key: "git:org/new",
      title: "New",
      listWorlds: async () => [],
      createWorld: async (input) => {
        expect(input.private).toBe(false);
        expect(input.stable_key).toBe("git:org/new");
        return { id: 42 };
      },
    });
    expect(r).toEqual({ world_id: 42, created: true });
  });
});

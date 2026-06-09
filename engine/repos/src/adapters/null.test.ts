import { describe, expect, it } from "bun:test";
import { nullPgRepositories } from "./null.ts";
import { nullSessionStore } from "./null-session.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";

describe("nullPgRepositories", () => {
  it("pgAvailable 为 false", () => {
    expect(nullPgRepositories.pgAvailable).toBe(false);
  });

  it("聚合各 null 端口", () => {
    expect(nullPgRepositories.session).toBe(nullSessionStore);
    expect(nullPgRepositories.semanticMemory).toBe(nullSemanticMemoryStore);
  });
});

describe("nullSessionStore", () => {
  it("读操作返回空", async () => {
    expect(await nullSessionStore.getSessionMeta("s")).toBeNull();
    expect(await nullSessionStore.listMessages("s")).toEqual([]);
  });

  it("写操作抛出 database.url 未配置", async () => {
    await expect(
      nullSessionStore.appendMessage("s", { role: "user", content: "x", pos: 1 }),
    ).rejects.toThrow(/database\.url/);
  });
});

describe("nullSemanticMemoryStore", () => {
  it("searchFts 返回空列表", async () => {
    expect(await nullSemanticMemoryStore.searchFts("q", { limit: 5 })).toEqual([]);
  });
});

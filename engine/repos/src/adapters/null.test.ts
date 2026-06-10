import { describe, expect, it } from "bun:test";
import { nullPgRepositories } from "./null.ts";
import { nullSessionStore } from "./null-session.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";

describe("nullPgRepositories", () => {
  it("pgAvailable is false", () => {
    expect(nullPgRepositories.pgAvailable).toBe(false);
  });

  it("aggregates null ports", () => {
    expect(nullPgRepositories.session).toBe(nullSessionStore);
    expect(nullPgRepositories.semanticMemory).toBe(nullSemanticMemoryStore);
  });
});

describe("nullSessionStore", () => {
  it("read operations return empty", async () => {
    expect(await nullSessionStore.getSessionMeta("s")).toBeNull();
    expect(await nullSessionStore.listMessages("s")).toEqual([]);
  });

  it("write operations throw database.url not configured", async () => {
    await expect(
      nullSessionStore.appendMessage("s", { role: "user", content: "x", pos: 1 }),
    ).rejects.toThrow(/database\.url/);
  });
});

describe("nullSemanticMemoryStore", () => {
  it("searchFts returns empty list", async () => {
    expect(await nullSemanticMemoryStore.searchFts("q", { limit: 5 })).toEqual([]);
  });
});

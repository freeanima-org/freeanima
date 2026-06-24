import { describe, expect, it } from "bun:test";
import { nullPgRepositories } from "./null.ts";
import { nullConversationStore } from "./null-conversation.ts";
import { nullSemanticMemoryStore } from "./null-semantic-memory.ts";

describe("nullPgRepositories", () => {
  it("pgAvailable is false", () => {
    expect(nullPgRepositories.pgAvailable).toBe(false);
  });

  it("aggregates null ports", () => {
    expect(nullPgRepositories.conversation).toBe(nullConversationStore);
    expect(nullPgRepositories.semanticMemory).toBe(nullSemanticMemoryStore);
  });
});

describe("nullConversationStore", () => {
  it("read operations return empty", async () => {
    expect(await nullConversationStore.getConversationMeta("s")).toBeNull();
    expect(await nullConversationStore.listMessages("s")).toEqual([]);
  });

  it("write operations throw database.url not configured", async () => {
    await expect(
      nullConversationStore.appendMessage("s", { role: "user", content: "x", pos: 1 }),
    ).rejects.toThrow(/database\.url/);
  });
});

describe("nullSemanticMemoryStore", () => {
  it("searchFts returns empty list", async () => {
    expect(await nullSemanticMemoryStore.searchFts("q", { limit: 5 })).toEqual([]);
  });
});

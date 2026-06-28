import { afterEach, describe, expect, it } from "bun:test";
import type { FridgeStorePort } from "./fridge-store-port.ts";
import { registerFridgeStore, resetFridgeStoreForTests } from "./fridge-store-port.ts";
import { createFridgeMagnetHandler } from "./handler.ts";
import { FRIDGE_CONTEXT_ASSISTANT_NAME } from "./inject.ts";
import { magnetRedisKey } from "./store.ts";

function createMemoryFridgeStore(entries: Record<string, string>): FridgeStorePort {
  const store = new Map(Object.entries(entries));
  return {
    set: async (key, value) => {
      store.set(key, value);
    },
    get: async (key) => store.get(key) ?? null,
    delete: async (key) => {
      store.delete(key);
    },
    scan: async (pattern) => {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value }));
    },
  };
}

describe("createFridgeMagnetHandler", () => {
  afterEach(() => {
    resetFridgeStoreForTests();
  });

  it("manifests fridge_context assistant before last user when magnets exist", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("conversation", "sess-a:note1")]: "Note A",
        [magnetRedisKey("conversation", "sess-b:note2")]: "Note B",
        [magnetRedisKey("tasks", "summary")]: "Todos (1)",
      }),
    );

    const messages = [{ role: "user", content: "Hello" }];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "assistant",
      name: FRIDGE_CONTEXT_ASSISTANT_NAME,
    });
    expect(messages[0]!.role === "assistant" && messages[0].content).toContain(
      "conversation:sess-a:note1: Note A",
    );
    expect(messages[1]).toMatchObject({ role: "user", content: "Hello" });
  });

  it("does not manifest when last message is not user", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("tasks", "summary")]: "Todos",
      }),
    );

    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Reply" },
    ];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages).toHaveLength(2);
    expect(
      messages.every(
        (m) => m.role !== "assistant" || !("name" in m && m.name === FRIDGE_CONTEXT_ASSISTANT_NAME),
      ),
    ).toBe(true);
  });

  it("does not manifest when last message is tool", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("tasks", "summary")]: "Todos",
      }),
    );

    const messages = [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "read", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "c1", content: "ok" },
    ];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages).toHaveLength(3);
    expect(
      messages.some(
        (m) => m.role === "assistant" && "name" in m && m.name === FRIDGE_CONTEXT_ASSISTANT_NAME,
      ),
    ).toBe(false);
  });

  it("does not manifest when redis board is empty", async () => {
    registerFridgeStore(createMemoryFridgeStore({}));

    const messages = [{ role: "user", content: "Hello" }];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages).toHaveLength(1);
  });

  it("strips prior manifest before remanifesting", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("conversation", "sess-a:note")]: "Fresh note",
      }),
    );

    const messages = [
      {
        role: "assistant",
        name: FRIDGE_CONTEXT_ASSISTANT_NAME,
        content: "old board",
      },
      { role: "user", content: "Hello" },
    ];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    const manifests = messages.filter(
      (m) => m.role === "assistant" && "name" in m && m.name === FRIDGE_CONTEXT_ASSISTANT_NAME,
    );
    expect(manifests).toHaveLength(1);
    expect(manifests[0]!.role === "assistant" && manifests[0].content).toContain(
      "conversation:sess-a:note: Fresh note",
    );
  });

  it("includes tasks module magnets", async () => {
    registerFridgeStore(
      createMemoryFridgeStore({
        [magnetRedisKey("tasks", "summary")]: "Todos",
      }),
    );

    const messages = [{ role: "user", content: "Hello" }];
    await createFridgeMagnetHandler()({
      conversationId: "sess-a",
      messages,
    } as Parameters<ReturnType<typeof createFridgeMagnetHandler>>[0]);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("assistant");
  });
});

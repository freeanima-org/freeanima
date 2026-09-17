import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  loadResolvedWorldContext,
  prefetchResolvedWorldContextIfAuthed,
  resetResolvedWorldContextCacheForTest,
} from "./world-context.ts";

const habitatTypedOriginal = await import("./habitat-typed-client.ts");

let worldsContextCalls = 0;

function restoreHabitatTypedClientModule(): void {
  mock.module("./habitat-typed-client.ts", () => habitatTypedOriginal);
}

describe("world-context prefetch", () => {
  afterEach(() => {
    worldsContextCalls = 0;
    delete (globalThis as { window?: Window & { portalShell?: unknown } }).window;
    resetResolvedWorldContextCacheForTest();
    mock.restore();
    restoreHabitatTypedClientModule();
  });

  test("prefetchResolvedWorldContextIfAuthed 无 token 时不调用 worlds.context", async () => {
    mock.module("./habitat-typed-client.ts", () => ({
      ...habitatTypedOriginal,
      getTypedHabitatClient: () => ({
        call: async (method: string) => {
          if (method === "worlds.context") worldsContextCalls += 1;
          return {
            user_subject_id: 1,
            user_world_id: 2,
            commons_world_id: 3,
          };
        },
      }),
    }));

    (globalThis as { window: Window }).window = {
      portalShell: { habitatUrl: "https://habitat.example.com" },
    } as unknown as Window;

    prefetchResolvedWorldContextIfAuthed();
    await Promise.resolve();
    expect(worldsContextCalls).toBe(0);
  });

  test("prefetchResolvedWorldContextIfAuthed 有 token 时拉取 worlds.context", async () => {
    mock.module("./habitat-typed-client.ts", () => ({
      ...habitatTypedOriginal,
      getTypedHabitatClient: () => ({
        call: async (method: string) => {
          if (method === "worlds.context") worldsContextCalls += 1;
          return {
            user_subject_id: 1,
            user_world_id: 2,
            commons_world_id: 3,
          };
        },
      }),
    }));

    (globalThis as { window: Window }).window = {
      portalShell: {
        habitatUrl: "https://habitat.example.com",
        remoteAuth: { token: "fa_at_test_token_abc" },
      },
    } as unknown as Window;

    prefetchResolvedWorldContextIfAuthed();
    await loadResolvedWorldContext();
    expect(worldsContextCalls).toBe(1);
  });
});

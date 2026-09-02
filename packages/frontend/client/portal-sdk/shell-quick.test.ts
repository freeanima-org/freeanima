import { afterEach, describe, expect, mock, test } from "bun:test";

const habitatTypedOriginal = await import("./habitat-typed-client.ts");
const worldContextOriginal = await import("./world-context.ts");

function restoreModules(): void {
  mock.module("./habitat-typed-client.ts", () => habitatTypedOriginal);
  mock.module("./world-context.ts", () => worldContextOriginal);
}

describe("shell-quick", () => {
  afterEach(() => {
    mock.restore();
    restoreModules();
  });

  test("detachShellQuick 更新 cache 后通知订阅者", async () => {
    mock.module("./world-context.ts", () => ({
      ...worldContextOriginal,
      getUserSubjectId: async () => 1,
    }));
    mock.module("./habitat-typed-client.ts", () => ({
      ...habitatTypedOriginal,
      getTypedHabitatClient: () => ({
        call: async (method: string) => {
          if (method === "shell_quick.list") {
            return {
              entries: [{ id: 42, primary_component: "note", quick_sort_order: 0, title: "n" }],
            };
          }
          return {};
        },
      }),
    }));

    const quick = await import("./shell-quick.ts");
    await quick.refreshShellQuickEntries();

    let notifyCount = 0;
    const unsub = quick.subscribeShellQuickEntries(() => {
      notifyCount += 1;
    });

    await quick.detachShellQuick(42);
    expect(quick.getShellQuickEntriesSnapshot()).toEqual([]);
    expect(notifyCount).toBe(1);
    unsub();
  });
});

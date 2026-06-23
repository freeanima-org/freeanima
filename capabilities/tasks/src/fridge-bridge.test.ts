import { describe, expect, it } from "bun:test";
import type { TaskRow, TaskStorePort } from "@freeanima/core/repos";
import { buildTasksSummaryContent, syncTasksSummary } from "./fridge-bridge.ts";
import type { FridgeBridge } from "./types.ts";

const NOW = new Date("2026-06-12T12:00:00.000Z");

function task(
  overrides: Partial<TaskRow> & Pick<TaskRow, "title"> & { due_at?: string | null },
): TaskRow {
  return {
    id: "task-1",
    description: null,
    status: "pending",
    priority: "none",
    due_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    completed_at: null,
    source_session_id: null,
    ...overrides,
  };
}

function createMockStore(rows: TaskRow[]): TaskStorePort {
  return {
    create: async () => {
      throw new Error("not implemented");
    },
    get: async () => null,
    update: async () => null,
    list: async () => rows,
    count: async () => rows.length,
  };
}

function createMockBridge(): {
  bridge: FridgeBridge;
  writes: { module: string; id: string; value: string }[];
  deletes: { module: string; id: string }[];
} {
  const writes: { module: string; id: string; value: string }[] = [];
  const deletes: { module: string; id: string }[] = [];
  return {
    bridge: {
      setMagnet: async (module, id, value) => {
        writes.push({ module, id, value });
      },
      deleteMagnet: async (module, id) => {
        deletes.push({ module, id });
      },
    },
    writes,
    deletes,
  };
}

describe("buildTasksSummaryContent", () => {
  it("undated task shows count only", () => {
    const content = buildTasksSummaryContent([task({ title: "Buy milk" })], NOW);
    expect(content).toBe("1 个待办");
  });

  it("due task shows title with priority emoji", () => {
    const content = buildTasksSummaryContent(
      [task({ title: "Return book", priority: "high", due_at: "2026-06-12T10:00:00.000Z" })],
      NOW,
    );
    expect(content).toBe("🔴 Return book");
  });

  it("mixes due titles and undated count", () => {
    const content = buildTasksSummaryContent(
      [
        task({ title: "Buy milk", priority: "high", due_at: "2026-06-12T08:00:00.000Z" }),
        task({ title: "Undated A" }),
        task({ title: "Undated B" }),
      ],
      NOW,
    );
    expect(content).toBe("🔴 Buy milk | 2 个待办");
  });

  it("future-dated tasks are hidden", () => {
    const content = buildTasksSummaryContent(
      [task({ title: "Future task", due_at: "2026-06-13T12:00:00.000Z" })],
      NOW,
    );
    expect(content).toBeNull();
  });

  it("empty rows return null", () => {
    expect(buildTasksSummaryContent([], NOW)).toBeNull();
  });

  it("limits due titles to earliest five", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      task({
        id: `task-${i}`,
        title: `Task ${i}`,
        due_at: `2026-06-12T0${i}:00:00.000Z`,
      }),
    );
    const content = buildTasksSummaryContent(rows, NOW);
    expect(content).toBe("Task 0 | Task 1 | Task 2 | Task 3 | Task 4");
  });
});

describe("syncTasksSummary", () => {
  it("writes summary when content exists", async () => {
    const { bridge, writes, deletes } = createMockBridge();
    await syncTasksSummary(createMockStore([task({ title: "Undated" })]), bridge);
    expect(writes).toEqual([{ module: "tasks", id: "summary", value: "1 个待办" }]);
    expect(deletes).toEqual([]);
  });

  it("deletes magnet when no content", async () => {
    const { bridge, writes, deletes } = createMockBridge();
    await syncTasksSummary(createMockStore([]), bridge);
    expect(writes).toEqual([]);
    expect(deletes).toEqual([{ module: "tasks", id: "summary" }]);
  });

  it("deletes magnet for future-dated only tasks", async () => {
    const { bridge, writes, deletes } = createMockBridge();
    await syncTasksSummary(
      createMockStore([task({ title: "Later", due_at: "2099-06-20T12:00:00.000Z" })]),
      bridge,
    );
    expect(writes).toEqual([]);
    expect(deletes).toEqual([{ module: "tasks", id: "summary" }]);
  });

  it("no-op without bridge", async () => {
    await syncTasksSummary(createMockStore([task({ title: "Undated" })]), undefined);
  });
});

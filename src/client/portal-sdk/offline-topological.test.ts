import { describe, expect, it } from "bun:test";
import type { OfflineOutboxOp } from "./offline-outbox.ts";
import { sortOutboxTopological } from "./offline-topological.ts";

describe("offline-topological", () => {
  it("orders parent create before child create", () => {
    const parent: OfflineOutboxOp = {
      id: "p1",
      moduleId: "task",
      method: "tasklist.create",
      payload: {},
      tempEntityId: -1,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const child: OfflineOutboxOp = {
      id: "c1",
      moduleId: "task",
      method: "tasklist.item.create",
      payload: { list_id: -1 },
      dependsOn: [{ tempId: -1, field: "list_id" }],
      createdAt: "2026-01-01T00:00:01.000Z",
    };
    const sorted = sortOutboxTopological([child, parent]);
    expect(sorted[0]?.id).toBe("p1");
    expect(sorted[1]?.id).toBe("c1");
  });
});

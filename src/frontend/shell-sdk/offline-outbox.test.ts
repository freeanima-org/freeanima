import { describe, expect, it, beforeEach } from "bun:test";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  setOfflineOutboxBackendForTests,
} from "./offline-outbox.ts";

describe("offline-outbox", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
  });

  it("enqueue and list by module", async () => {
    await enqueueOutboxOp("scope-a", {
      id: "op-1",
      moduleId: "chat",
      method: "message.send",
      payload: { conversation_id: "c1", message: "hi", client_op_id: "op-1" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await enqueueOutboxOp("scope-a", {
      id: "op-2",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const chatOps = await listOutboxOps("scope-a", "chat");
    expect(chatOps).toHaveLength(1);
    expect(chatOps[0]?.id).toBe("op-1");
  });

  it("remove outbox op", async () => {
    await enqueueOutboxOp("scope-a", {
      id: "op-1",
      moduleId: "chat",
      method: "message.send",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await removeOutboxOp("scope-a", "op-1");
    expect(await listOutboxOps("scope-a", "chat")).toHaveLength(0);
  });
});

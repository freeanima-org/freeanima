import { describe, expect, it, beforeEach } from "bun:test";
import {
  enqueueOutboxOp,
  listFailedOutboxOps,
  listOutboxOps,
  markOutboxOpStale,
  OFFLINE_OUTBOX_MAX_ATTEMPTS,
  removeOutboxOp,
  resetOutboxOpForRetry,
  setOfflineOutboxBackendForTests,
  shouldAutoRetryOp,
  updateOutboxOpError,
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

  it("updateOutboxOpError increments attempts", async () => {
    await enqueueOutboxOp("scope-a", {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await updateOutboxOpError("scope-a", "op-1", "validation failed");
    const op = (await listOutboxOps("scope-a", "diary"))[0];
    expect(op?.attempts).toBe(1);
    expect(op?.lastError).toBe("validation failed");
    expect(op?.syncStatus).toBe("failed");
  });

  it("shouldAutoRetryOp stops after max attempts", async () => {
    const op = {
      id: "op-1",
      moduleId: "diary" as const,
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      attempts: OFFLINE_OUTBOX_MAX_ATTEMPTS,
      syncStatus: "failed" as const,
      lastError: "flush failed",
    };
    expect(shouldAutoRetryOp(op)).toBe(false);
  });

  it("markOutboxOpStale and listFailedOutboxOps", async () => {
    await enqueueOutboxOp("scope-a", {
      id: "op-1",
      moduleId: "chat",
      method: "message.send",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await markOutboxOpStale("scope-a", "op-1");
    const failed = await listFailedOutboxOps("scope-a", "chat");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.syncStatus).toBe("stale");
  });

  it("resetOutboxOpForRetry clears error state", async () => {
    await enqueueOutboxOp("scope-a", {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await updateOutboxOpError("scope-a", "op-1", "boom");
    await resetOutboxOpForRetry("scope-a", "op-1");
    const op = (await listOutboxOps("scope-a", "diary"))[0];
    expect(op?.lastError).toBeUndefined();
    expect(op?.attempts).toBe(0);
    expect(op?.syncStatus).toBeUndefined();
  });
});

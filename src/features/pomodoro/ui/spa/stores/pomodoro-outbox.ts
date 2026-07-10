import { create } from "zustand";
import { getSatelliteHubClient } from "@freeanima/shared/hub-client";

import { ackPomodoroOutboxOp, listPomodoroOutboxOps } from "../lib/pomodoro-offline-store.ts";
import { updateOutboxOpError } from "@freeanima/frontend/shell-sdk/offline-outbox";
import { resolveOutboxScope } from "@freeanima/frontend/shell-sdk/offline-outbox";

type PomodoroOutboxState = {
  flushing: boolean;
  flushAll: () => Promise<void>;
};

async function flushOneOp(
  op: Awaited<ReturnType<typeof listPomodoroOutboxOps>>[number],
): Promise<boolean> {
  const hub = getSatelliteHubClient();
  const call = hub.call.bind(hub) as (
    method: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  try {
    await call(op.method, op.payload);
    await ackPomodoroOutboxOp(op.id);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateOutboxOpError(resolveOutboxScope(), op.id, msg);
    return false;
  }
}

export const usePomodoroOutboxStore = create<PomodoroOutboxState>(() => ({
  flushing: false,
  flushAll: async () => {
    const store = usePomodoroOutboxStore.getState();
    if (store.flushing) return;
    usePomodoroOutboxStore.setState({ flushing: true });
    try {
      const ops = await listPomodoroOutboxOps();
      for (const op of ops) {
        await flushOneOp(op);
      }
    } finally {
      usePomodoroOutboxStore.setState({ flushing: false });
    }
  },
}));

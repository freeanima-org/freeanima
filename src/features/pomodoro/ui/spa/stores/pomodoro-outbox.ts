import { create } from "zustand";
import { flushOfflineModule } from "@freeanima/frontend/portal-sdk/offline-sync";
import { resolveOutboxScope } from "@freeanima/frontend/portal-sdk/offline-outbox";

import { POMODORO_OUTBOX_MODULE_ID } from "../lib/pomodoro-offline-store.ts";

type PomodoroOutboxState = {
  flushing: boolean;
  flushAll: () => Promise<void>;
};

export const usePomodoroOutboxStore = create<PomodoroOutboxState>(() => ({
  flushing: false,
  flushAll: async () => {
    const store = usePomodoroOutboxStore.getState();
    if (store.flushing) return;
    usePomodoroOutboxStore.setState({ flushing: true });
    try {
      await flushOfflineModule(POMODORO_OUTBOX_MODULE_ID, resolveOutboxScope());
    } finally {
      usePomodoroOutboxStore.setState({ flushing: false });
    }
  },
}));

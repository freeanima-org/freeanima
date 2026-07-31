import { useCallback, useEffect, useState } from "react";
import { buildHeadlessChatStreamFlushContext } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { updateChatSendPayload } from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import {
  getGlobalOutboxSummary,
  type GlobalOutboxSummary,
} from "@freeanima/client/portal-sdk/offline-module-cap";
import { getOfflineModule } from "@freeanima/client/portal-sdk/offline-module-registry";
import {
  isStaleOutboxOp,
  removeOutboxOp,
  resetOutboxOpForRetry,
  resolveOutboxScope,
  type OfflineModuleId,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import {
  flushAllOfflineModules,
  flushOfflineModule,
  subscribeOfflineSyncTriggers,
} from "@freeanima/client/portal-sdk/offline-sync";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { reconnectHabitat, useHabitatConnection } from "@freeanima/client/portal-sdk/react.tsx";
import type { StreamFlushContext } from "@freeanima/client/portal-sdk/offline-module-types";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";

import { m } from "@paraglide/messages";

import { registerAllOfflineModules } from "./register-offline-modules.ts";
import {
  buildOfflineSyncSummaryMessage,
  shouldShowOfflineSyncToast,
} from "./offline-sync-toast.ts";
import {
  getChatStreamContextFactory,
  registerChatStreamContextFactory,
} from "@freeanima/client/portal-sdk/chat-stream-context.ts";

export { registerChatStreamContextFactory };

function resolveChatStreamContext(forceTail = false): StreamFlushContext {
  const uiCtx = getChatStreamContextFactory()?.() ?? null;
  if (uiCtx) {
    return forceTail ? { ...uiCtx, forceTail: true } : uiCtx;
  }
  return buildHeadlessChatStreamFlushContext(forceTail);
}

function resolveFlushOptions(forceTail = false) {
  const chatCtx = resolveChatStreamContext(forceTail);
  return {
    streamContext: chatCtx,
    streamContextByModule: { chat: chatCtx } as const,
  };
}

function moduleLabel(moduleId: OfflineModuleId): string {
  switch (moduleId) {
    case "chat":
      return m.ui_offline_sync_module_chat();
    case "diary":
      return m.ui_offline_sync_module_diary();
    case "calendar":
      return m.ui_offline_sync_module_calendar();
    case "task":
      return m.ui_offline_sync_module_task();
    case "project":
      return m.ui_offline_sync_module_project();
    case "pomodoro":
      return m.ui_offline_sync_module_pomodoro();
    default:
      return moduleId;
  }
}

function problemOps(summary: GlobalOutboxSummary): OfflineOutboxOp[] {
  return summary.ops.filter((op) => Boolean(op.lastError) || isStaleOutboxOp(op));
}

function buildIssueDescription(issues: OfflineOutboxOp[]): string | undefined {
  if (issues.length === 0) return undefined;
  return issues
    .slice(0, 3)
    .map((op) => {
      const label = moduleLabel(op.moduleId);
      if (op.lastError && op.lastError !== "stale") return `${label}: ${op.lastError}`;
      if (isStaleOutboxOp(op)) return `${label}: ${m.ui_outbox_stale_hint()}`;
      return label;
    })
    .join("\n");
}

export function OfflineSyncBootstrap(): null {
  const habitatConnection = useHabitatConnection();
  const [summary, setSummary] = useState<GlobalOutboxSummary>({
    pending: 0,
    failed: 0,
    stale: 0,
    ops: [],
  });
  const [busy, setBusy] = useState(false);

  const refreshSummary = useCallback(() => {
    void getGlobalOutboxSummary(resolveOutboxScope()).then(setSummary);
  }, []);

  useEffect(() => {
    registerAllOfflineModules();
  }, []);

  useEffect(() => {
    refreshSummary();
    const timer = window.setInterval(refreshSummary, 3000);
    return () => clearInterval(timer);
  }, [refreshSummary]);

  const runFlush = useCallback(
    async (opts?: { forceRetry?: boolean; forceTail?: boolean }) => {
      if (!isHabitatFetchAvailable()) return;
      const scope = resolveOutboxScope();
      await flushAllOfflineModules(scope, {
        ...resolveFlushOptions(opts?.forceTail ?? false),
        ...(opts?.forceRetry ? { forceRetry: true } : {}),
      });
      refreshSummary();
    },
    [refreshSummary],
  );

  useEffect(() => {
    const flush = () => {
      void runFlush();
    };
    return subscribeOfflineSyncTriggers(flush);
  }, [runFlush]);

  useEffect(() => {
    if (habitatConnection !== "connected") return;
    void runFlush();
  }, [habitatConnection, runFlush]);

  const handleRetryAll = useCallback(async () => {
    setBusy(true);
    try {
      await reconnectHabitat();
      const scope = resolveOutboxScope();
      for (const op of problemOps(summary)) {
        await resetOutboxOpForRetry(scope, op.id);
      }
      await runFlush({ forceRetry: true });
    } finally {
      setBusy(false);
    }
  }, [runFlush, summary]);

  const handleRetryOp = useCallback(
    async (op: OfflineOutboxOp) => {
      setBusy(true);
      try {
        const scope = resolveOutboxScope();
        const forceTail = op.moduleId === "chat" && isStaleOutboxOp(op);
        await resetOutboxOpForRetry(scope, op.id);
        if (forceTail) {
          await updateChatSendPayload(op.id, { force_tail: true }, scope);
        }
        await flushOfflineModule(op.moduleId, scope, {
          ...resolveFlushOptions(forceTail),
          forceRetry: true,
        });
        refreshSummary();
      } finally {
        setBusy(false);
      }
    },
    [refreshSummary],
  );

  const handleDiscardOp = useCallback(
    async (op: OfflineOutboxOp) => {
      setBusy(true);
      try {
        const scope = resolveOutboxScope();
        await removeOutboxOp(scope, op.id);
        if (isHabitatFetchAvailable()) {
          const adapter = getOfflineModule(op.moduleId);
          await adapter?.refreshAll?.(scope);
        }
        refreshSummary();
      } finally {
        setBusy(false);
      }
    },
    [refreshSummary],
  );

  const issues = problemOps(summary);
  const showToast = shouldShowOfflineSyncToast(summary, habitatConnection);

  useEffect(() => {
    if (!showToast) {
      dismissShellToast(SHELL_TOAST_IDS.offlineSync);
      return;
    }

    const firstIssue = issues[0];
    const description = buildIssueDescription(issues);
    const message = buildOfflineSyncSummaryMessage(summary, habitatConnection, {
      pending: (count) => m.ui_offline_sync_pending({ count }),
      failed: (count) => m.ui_offline_sync_failed({ count }),
      stale: (count) => m.ui_offline_sync_stale({ count }),
    });

    if (firstIssue) {
      showShellToast(SHELL_TOAST_IDS.offlineSync, message, {
        ...(description != null ? { description } : {}),
        action: {
          label:
            isStaleOutboxOp(firstIssue) && firstIssue.moduleId === "chat"
              ? m.ui_outbox_force_send()
              : m.ui_offline_sync_retry(),
          onClick: () => {
            if (!busy) void handleRetryOp(firstIssue);
          },
        },
        cancel: {
          label: m.ui_outbox_discard(),
          onClick: () => {
            if (!busy) void handleDiscardOp(firstIssue);
          },
        },
      });
      return;
    }

    showShellToast(SHELL_TOAST_IDS.offlineSync, message, {
      action: {
        label: m.ui_offline_sync_retry_all(),
        onClick: () => {
          if (!busy) void handleRetryAll();
        },
      },
    });
  }, [
    busy,
    handleDiscardOp,
    handleRetryAll,
    handleRetryOp,
    habitatConnection,
    issues,
    showToast,
    summary,
  ]);

  return null;
}

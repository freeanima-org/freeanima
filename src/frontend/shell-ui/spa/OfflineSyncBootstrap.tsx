import { useCallback, useEffect, useState } from "react";
import { buildHeadlessChatStreamFlushContext } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { updateChatSendPayload } from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import {
  getGlobalOutboxSummary,
  type GlobalOutboxSummary,
} from "@freeanima/frontend/shell-sdk/offline-module-cap";
import {
  isStaleOutboxOp,
  resetOutboxOpForRetry,
  resolveOutboxScope,
  type OfflineModuleId,
  type OfflineOutboxOp,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import {
  flushAllOfflineModules,
  flushOfflineModule,
  subscribeOfflineSyncTriggers,
} from "@freeanima/frontend/shell-sdk/offline-sync";
import { isHabitatFetchAvailable } from "@freeanima/frontend/shell-sdk/habitat-fetch-gate";
import { reconnectHabitat, useHabitatConnection } from "@freeanima/frontend/shell-sdk/react.tsx";
import type { StreamFlushContext } from "@freeanima/frontend/shell-sdk/offline-module-types";
import {
  dismissShellToast,
  showShellToast,
  SHELL_TOAST_IDS,
} from "@freeanima/frontend/ui-kit/composite";

import { m } from "@paraglide/messages";

import { registerAllOfflineModules } from "./register-offline-modules.ts";

let chatStreamContextFactory: (() => StreamFlushContext | null) | null = null;

export function registerChatStreamContextFactory(factory: () => StreamFlushContext | null): void {
  chatStreamContextFactory = factory;
}

function resolveChatStreamContext(forceTail = false): StreamFlushContext {
  const uiCtx = chatStreamContextFactory?.() ?? null;
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

function buildSummaryMessage(summary: GlobalOutboxSummary): string {
  const parts: string[] = [];
  if (summary.pending > 0) parts.push(m.ui_offline_sync_pending({ count: summary.pending }));
  if (summary.failed > 0) parts.push(m.ui_offline_sync_failed({ count: summary.failed }));
  if (summary.stale > 0) parts.push(m.ui_offline_sync_stale({ count: summary.stale }));
  return parts.join(" · ");
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

  const total = summary.pending + summary.failed + summary.stale;
  const issues = problemOps(summary);

  useEffect(() => {
    if (total <= 0) {
      dismissShellToast(SHELL_TOAST_IDS.offlineSync);
      return;
    }

    const firstIssue = issues[0];
    const description = buildIssueDescription(issues);
    showShellToast(SHELL_TOAST_IDS.offlineSync, buildSummaryMessage(summary), {
      ...(description != null ? { description } : {}),
      action: {
        label: m.ui_offline_sync_retry_all(),
        onClick: () => {
          if (!busy) void handleRetryAll();
        },
      },
      ...(firstIssue
        ? {
            cancel: {
              label:
                isStaleOutboxOp(firstIssue) && firstIssue.moduleId === "chat"
                  ? m.ui_outbox_force_send()
                  : m.ui_offline_sync_retry(),
              onClick: () => {
                if (!busy) void handleRetryOp(firstIssue);
              },
            },
          }
        : {}),
    });
  }, [busy, handleRetryAll, handleRetryOp, issues, summary, total]);

  return null;
}

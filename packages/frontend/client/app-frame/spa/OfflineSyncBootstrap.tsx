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
import { subscribeLocalPrefer } from "@freeanima/client/portal-sdk/local-prefer";
import { reconnectHabitat, useHabitatConnection } from "@freeanima/client/portal-sdk/react.tsx";
import type { StreamFlushContext } from "@freeanima/client/portal-sdk/offline-module-types";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";

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
      return "聊天室";
    case "diary":
      return "日记";
    case "calendar":
      return "日程";
    case "task":
      return "任务";
    case "project":
      return "项目";
    case "pomodoro":
      return "番茄钟";
    case "note":
      return "笔记";
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
      if (isStaleOutboxOp(op)) return `${label}: 对话已在其他设备上继续`;
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
    return subscribeLocalPrefer((active) => {
      if (!active) void runFlush();
    });
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
      pending: (count) => `${count} 项待同步`,
      failed: (count) => `${count} 项同步失败`,
      stale: (count) => `${count} 处冲突`,
    });

    if (firstIssue) {
      showShellToast(SHELL_TOAST_IDS.offlineSync, message, {
        ...(description != null ? { description } : {}),
        action: {
          label:
            isStaleOutboxOp(firstIssue) && firstIssue.moduleId === "chat" ? "仍然发送" : "重试",
          onClick: () => {
            if (!busy) void handleRetryOp(firstIssue);
          },
        },
        cancel: {
          label: "丢弃",
          onClick: () => {
            if (!busy) void handleDiscardOp(firstIssue);
          },
        },
      });
      return;
    }

    showShellToast(SHELL_TOAST_IDS.offlineSync, message, {
      action: {
        label: "重新连接并全部重试",
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

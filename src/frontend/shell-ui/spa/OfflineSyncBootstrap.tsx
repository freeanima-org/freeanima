import { useCallback, useEffect, useState, type JSX } from "react";
import { buildHeadlessChatStreamFlushContext } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { updateChatSendPayload } from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import {
  getGlobalOutboxSummary,
  type GlobalOutboxSummary,
} from "@freeanima/frontend/shell-sdk/offline-module-cap";
import {
  isStaleOutboxOp,
  removeOutboxOp,
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
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { reconnectHub, useHubConnection } from "@freeanima/frontend/shell-sdk/react.tsx";
import type { StreamFlushContext } from "@freeanima/frontend/shell-sdk/offline-module-types";

import { m } from "@paraglide/messages";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";

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
    case "pomodoro":
      return m.ui_offline_sync_module_pomodoro();
    default:
      return moduleId;
  }
}

function problemOps(summary: GlobalOutboxSummary): OfflineOutboxOp[] {
  return summary.ops.filter((op) => Boolean(op.lastError) || isStaleOutboxOp(op));
}

export function OfflineSyncBootstrap(): JSX.Element | null {
  const hubConnection = useHubConnection();
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
      if (!isHubFetchAvailable()) return;
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
    if (hubConnection !== "connected") return;
    void runFlush();
  }, [hubConnection, runFlush]);

  const total = summary.pending + summary.failed + summary.stale;
  if (total <= 0) return null;

  const issues = problemOps(summary);
  const variant = summary.failed > 0 || summary.stale > 0 ? "warning" : "info";

  const handleRetryAll = async () => {
    setBusy(true);
    try {
      await reconnectHub();
      const scope = resolveOutboxScope();
      for (const op of issues) {
        await resetOutboxOpForRetry(scope, op.id);
      }
      await runFlush({ forceRetry: true });
    } finally {
      setBusy(false);
    }
  };

  const handleRetryOp = async (op: OfflineOutboxOp) => {
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
  };

  const handleDiscardOp = async (op: OfflineOutboxOp) => {
    await removeOutboxOp(resolveOutboxScope(), op.id);
    refreshSummary();
  };

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant={variant}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 text-sm">
              {summary.pending > 0 ? (
                <span>{m.ui_offline_sync_pending({ count: summary.pending })}</span>
              ) : null}
              {summary.failed > 0 ? (
                <span>{m.ui_offline_sync_failed({ count: summary.failed })}</span>
              ) : null}
              {summary.stale > 0 ? (
                <span>{m.ui_offline_sync_stale({ count: summary.stale })}</span>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs underline disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void handleRetryAll();
              }}
            >
              {m.ui_offline_sync_retry_all()}
            </button>
          </div>

          {issues.length > 0 ? (
            <ul className="flex flex-col gap-2 text-xs">
              {issues.slice(0, 8).map((op) => (
                <li
                  key={op.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {moduleLabel(op.moduleId)} · {op.method}
                    </div>
                    {op.lastError && op.lastError !== "stale" ? (
                      <div className="mt-0.5 break-words opacity-80">{op.lastError}</div>
                    ) : isStaleOutboxOp(op) ? (
                      <div className="mt-0.5 opacity-80">{m.ui_outbox_stale_hint()}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => {
                        void handleRetryOp(op);
                      }}
                    >
                      {isStaleOutboxOp(op) && op.moduleId === "chat"
                        ? m.ui_outbox_force_send()
                        : m.ui_offline_sync_retry()}
                    </button>
                    <button
                      type="button"
                      className="underline disabled:opacity-50"
                      onClick={() => {
                        void handleDiscardOp(op);
                      }}
                    >
                      {m.ui_outbox_discard()}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </StatusAlert>
    </div>
  );
}

import { useEffect, useState, type JSX } from "react";
import { registerChatOfflineModule } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import { getGlobalPendingCount } from "@freeanima/frontend/shell-sdk/offline-module-cap";
import { resolveOutboxScope } from "@freeanima/frontend/shell-sdk/offline-outbox";
import {
  flushAllOfflineModules,
  subscribeOfflineSyncTriggers,
} from "@freeanima/frontend/shell-sdk/offline-sync";
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { reconnectHub, useHubConnection } from "@freeanima/frontend/shell-sdk/react.tsx";

import { m } from "@paraglide/messages";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";

let chatStreamContextFactory:
  | (() => import("@freeanima/frontend/shell-sdk/offline-module-types").StreamFlushContext | null)
  | null = null;

export function registerChatStreamContextFactory(
  factory: () =>
    | import("@freeanima/frontend/shell-sdk/offline-module-types").StreamFlushContext
    | null,
): void {
  chatStreamContextFactory = factory;
}

export function OfflineSyncBootstrap(): JSX.Element | null {
  const hubConnection = useHubConnection();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    registerChatOfflineModule();
  }, []);

  useEffect(() => {
    const refreshPending = () => {
      void getGlobalPendingCount(resolveOutboxScope()).then(setPending);
    };
    refreshPending();
    const timer = window.setInterval(refreshPending, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const flush = () => {
      if (!isHubFetchAvailable()) return;
      const scope = resolveOutboxScope();
      const streamCtx = chatStreamContextFactory?.() ?? undefined;
      void flushAllOfflineModules(
        scope,
        streamCtx
          ? { streamContext: streamCtx, streamContextByModule: { chat: streamCtx } }
          : undefined,
      ).then(() => {
        void getGlobalPendingCount(scope).then(setPending);
      });
    };

    const unsubSync = subscribeOfflineSyncTriggers(flush);
    return unsubSync;
  }, []);

  useEffect(() => {
    if (hubConnection !== "connected") return;
    const scope = resolveOutboxScope();
    const streamCtx = chatStreamContextFactory?.() ?? undefined;
    void flushAllOfflineModules(
      scope,
      streamCtx
        ? { streamContext: streamCtx, streamContextByModule: { chat: streamCtx } }
        : undefined,
    ).then(() => {
      void getGlobalPendingCount(scope).then(setPending);
    });
  }, [hubConnection]);

  if (pending <= 0) return null;

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant="info">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{pending} 项待同步</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => {
              void reconnectHub();
            }}
          >
            {m.console_common_reconnect()}
          </button>
        </div>
      </StatusAlert>
    </div>
  );
}

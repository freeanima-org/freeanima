import { useEffect, useState, type ReactNode } from "react";

import {
  isFailedOutboxOp,
  isStaleOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import { isOfflineOutboxDevtoolsEnabled } from "@freeanima/client/portal-sdk/shell-debug-config";
import { useGlobalOutboxSummary } from "@freeanima/client/portal-sdk/use-outbox-summary";
import { Button } from "@freeanima/ui-kit/components/ui/button.tsx";

import { DEBUG_CONFIG_CHANGED_EVENT } from "./debug-config-events.ts";

function opStatusLabel(op: OfflineOutboxOp): "pending" | "failed" | "stale" {
  if (isStaleOutboxOp(op)) return "stale";
  if (isFailedOutboxOp(op)) return "failed";
  return "pending";
}

/**
 * 只读 Offline Outbox Devtools：scope + pending/failed/stale + op id。
 * 门禁：Vite DEV，或设置「离线 Outbox 调试面板」/ localStorage flag。
 */
export function OfflineOutboxDevtools(): ReactNode {
  const [allowed, setAllowed] = useState(() => isOfflineOutboxDevtoolsEnabled());
  const [open, setOpen] = useState(false);
  const scope = resolveOutboxScope();
  const summary = useGlobalOutboxSummary(scope);

  useEffect(() => {
    const refresh = (): void => {
      setAllowed(isOfflineOutboxDevtoolsEnabled());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(DEBUG_CONFIG_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DEBUG_CONFIG_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!allowed) return null;

  const total = summary.pending + summary.failed + summary.stale;
  const ops = [...summary.ops].toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div
      className="pointer-events-auto fixed z-[80] max-w-[min(22rem,calc(100vw-1.5rem))]"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right, 0px))",
        bottom: "calc(var(--app-bottom-nav-h, 0px) + var(--sab, 0px) + 0.75rem)",
      }}
    >
      {!open ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-background/95 shadow-md backdrop-blur-sm"
          onClick={() => setOpen(true)}
          aria-label="打开离线 Outbox 调试面板"
        >
          Outbox {total > 0 ? `${summary.pending}/${summary.failed}/${summary.stale}` : "0"}
        </Button>
      ) : (
        <div className="flex max-h-[min(50vh,28rem)] flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Offline Outbox</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={scope}>
                scope {scope}
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              收起
            </Button>
          </div>
          <div className="flex gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>pending {summary.pending}</span>
            <span>failed {summary.failed}</span>
            <span>stale {summary.stale}</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
            {ops.length === 0 ? (
              <li className="px-1 py-2 text-xs text-muted-foreground">队列为空</li>
            ) : (
              ops.map((op) => {
                const status = opStatusLabel(op);
                return (
                  <li key={op.id} className="border-b border-border/60 px-1 py-1.5 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] text-foreground">{op.id}</span>
                      <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                        {status}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {op.moduleId} · {op.method}
                      {op.attempts != null ? ` · ×${op.attempts}` : ""}
                    </p>
                    {op.lastError ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-destructive">
                        {op.lastError}
                      </p>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

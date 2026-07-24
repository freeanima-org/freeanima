import type { GlobalOutboxSummary } from "@freeanima/client/portal-sdk/offline-module-cap";
import type { HabitatConnectionState } from "@freeanima/client/portal-sdk/habitat-connection";

/** Bootstrap toast：失败/冲突始终展示；纯 pending 仅在未 connected 时展示。 */
export function shouldShowOfflineSyncToast(
  summary: Pick<GlobalOutboxSummary, "pending" | "failed" | "stale">,
  habitatConnection: HabitatConnectionState,
): boolean {
  if (summary.failed > 0 || summary.stale > 0) return true;
  if (summary.pending > 0 && habitatConnection !== "connected") return true;
  return false;
}

export function buildOfflineSyncSummaryMessage(
  summary: Pick<GlobalOutboxSummary, "pending" | "failed" | "stale">,
  habitatConnection: HabitatConnectionState,
  format: {
    pending: (count: number) => string;
    failed: (count: number) => string;
    stale: (count: number) => string;
  },
): string {
  const parts: string[] = [];
  const showPending = summary.pending > 0 && habitatConnection !== "connected";
  if (showPending) parts.push(format.pending(summary.pending));
  if (summary.failed > 0) parts.push(format.failed(summary.failed));
  if (summary.stale > 0) parts.push(format.stale(summary.stale));
  return parts.join(" · ");
}

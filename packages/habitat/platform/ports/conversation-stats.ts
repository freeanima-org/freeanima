import { platformPorts } from "./service.ts";

export type StatsReportOpts = {
  allConversations?: boolean;
};

export type StatsReportFn = (
  conversationId?: string | null,
  opts?: StatsReportOpts,
) => Promise<string>;

/** Composition root binds the implementation onto `ctx.platformPorts`. */
export function registerStatsReport(fn: StatsReportFn): void {
  platformPorts().statsReport = fn;
}

export function unregisterStatsReport(): void {
  platformPorts().statsReport = null;
}

export async function statsReport(
  conversationId?: string | null,
  opts?: StatsReportOpts,
): Promise<string> {
  const fn = platformPorts().statsReport;
  if (!fn) {
    throw new Error("statsReport not registered: load @freeanima/habitat/platform first");
  }
  return fn(conversationId, opts);
}

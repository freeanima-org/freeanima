export type StatsReportOpts = {
  allConversations?: boolean;
};

export type StatsReportFn = (
  conversationId?: string | null,
  opts?: StatsReportOpts,
) => Promise<string>;

let statsReportImpl: StatsReportFn | null = null;

export function registerStatsReport(fn: StatsReportFn): void {
  statsReportImpl = fn;
}

export function unregisterStatsReport(): void {
  statsReportImpl = null;
}

export async function statsReport(
  conversationId?: string | null,
  opts?: StatsReportOpts,
): Promise<string> {
  if (!statsReportImpl) {
    throw new Error("statsReport not registered: load @freeanima/platform first");
  }
  return statsReportImpl(conversationId, opts);
}

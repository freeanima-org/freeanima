export type StatsReportOpts = {
  allSessions?: boolean;
};

export type StatsReportFn = (session?: string | null, opts?: StatsReportOpts) => Promise<string>;

let statsReportImpl: StatsReportFn | null = null;

export function registerStatsReport(fn: StatsReportFn): void {
  statsReportImpl = fn;
}

export function unregisterStatsReport(): void {
  statsReportImpl = null;
}

export async function statsReport(
  session?: string | null,
  opts?: StatsReportOpts,
): Promise<string> {
  if (!statsReportImpl) {
    throw new Error("statsReport not registered: load @freeanima/service first");
  }
  return statsReportImpl(session, opts);
}

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
    throw new Error("statsReport 未注册：请先加载 @freeanima/service");
  }
  return statsReportImpl(session, opts);
}

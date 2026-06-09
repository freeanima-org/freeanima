import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useState } from "react";
import { getDeepSleepRounds, getSleepSummary, listSleepRuns } from "@/lib/api.ts";

type CronLogRow = {
  id: number;
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at: string;
  output: Record<string, unknown> | null;
  output_text: string | null;
  error: string | null;
};

type SleepSummaryView = {
  light_sleep: {
    last_day?: string;
    last_run_at?: string;
    stats?: { tool_calls?: number; sessions?: number };
  };
  deep_sleep: {
    last_day?: string;
    last_run_at?: string;
    stats?: { total_tool_calls?: number };
    rounds_completed?: number;
  };
};

type DeepSleepRound = {
  round: string;
  round_index: number;
  output: { tool_calls: number; summary: string };
  change_log_snapshot: {
    addedIds?: string[];
    modifiedIds?: string[];
    deprecatedIds?: string[];
  };
};

export const Route = createFileRoute("/chamber/sleep")({
  loader: async () => {
    const [summary, runs] = await Promise.all([
      getSleepSummary().catch(() => null),
      listSleepRuns({ limit: 50 }).catch(() => ({ items: [] })),
    ]);
    return { summary, runs: (runs as { items?: CronLogRow[] }).items ?? [] };
  },
  component: SleepPage,
});

function formatTs(iso: string | undefined | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function jobLabel(id: string) {
  if (id === "builtin-light-sleep") return "浅睡";
  if (id === "builtin-deep-sleep") return "深睡";
  return id;
}

function outputDay(row: CronLogRow): string {
  const day = row.output?.day;
  return typeof day === "string" ? day : "—";
}

function outputToolCalls(row: CronLogRow): string {
  if (!row.ok || !row.output) return "—";
  const total = row.output.total_tool_calls;
  const toolCalls = row.output.tool_calls;
  const n = typeof total === "number" ? total : typeof toolCalls === "number" ? toolCalls : null;
  return n != null ? String(n) : "—";
}

function SleepPage() {
  const initial = Route.useLoaderData() as {
    summary: SleepSummaryView | null;
    runs: CronLogRow[];
  };

  const [summary] = useState<SleepSummaryView | null>(initial.summary);
  const [runs, setRuns] = useState(initial.runs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<DeepSleepRound[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSleepRuns({ limit: 50 });
      setRuns((data as { items?: CronLogRow[] }).items ?? []);
    } catch (e) {
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRounds = useCallback(async (day: string) => {
    setRoundsLoading(true);
    try {
      const data = (await getDeepSleepRounds(day)) as { rounds?: DeepSleepRound[] };
      setRounds(data.rounds ?? []);
    } catch {
      setRounds([]);
    } finally {
      setRoundsLoading(false);
    }
  }, []);

  const toggleExpand = (row: CronLogRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      setRounds([]);
      return;
    }
    setExpandedId(row.id);
    const day = outputDay(row);
    if (day !== "—" && row.job_id === "builtin-deep-sleep" && row.ok) {
      void loadRounds(day);
    } else {
      setRounds([]);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">😴 睡眠记录</h2>
      <p className="text-sm text-base-content/60 mb-4">
        浅睡 / 深睡 cron 运行历史（来自 cron_log）与最新运行态快照。
      </p>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="card bg-base-200 p-4">
            <h3 className="font-semibold mb-2">浅睡最新</h3>
            <p className="text-sm">处理日: {summary.light_sleep.last_day ?? "—"}</p>
            <p className="text-sm">运行: {formatTs(summary.light_sleep.last_run_at)}</p>
            <p className="text-sm">
              工具调用: {summary.light_sleep.stats?.tool_calls ?? 0} · sessions:{" "}
              {summary.light_sleep.stats?.sessions ?? 0}
            </p>
          </div>
          <div className="card bg-base-200 p-4">
            <h3 className="font-semibold mb-2">深睡最新</h3>
            <p className="text-sm">处理日: {summary.deep_sleep.last_day ?? "—"}</p>
            <p className="text-sm">运行: {formatTs(summary.deep_sleep.last_run_at)}</p>
            <p className="text-sm">
              工具调用: {summary.deep_sleep.stats?.total_tool_calls ?? 0} · 轮次:{" "}
              {summary.deep_sleep.rounds_completed ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? "刷新中…" : "刷新列表"}
        </button>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>时间</th>
              <th>任务</th>
              <th>处理日</th>
              <th>状态</th>
              <th>工具</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((row) => (
              <Fragment key={row.id}>
                <tr className={row.ok ? "" : "bg-error/10"}>
                  <td className="whitespace-nowrap">{formatTs(row.finished_at)}</td>
                  <td>{jobLabel(row.job_id)}</td>
                  <td>{outputDay(row)}</td>
                  <td>{row.ok ? "成功" : "失败"}</td>
                  <td>{outputToolCalls(row)}</td>
                  <td>
                    <button type="button" className="btn btn-xs" onClick={() => toggleExpand(row)}>
                      {expandedId === row.id ? "收起" : "详情"}
                    </button>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={6} className="bg-base-200">
                      {!row.ok && row.error && (
                        <pre className="text-xs text-error whitespace-pre-wrap break-all">
                          {row.error}
                        </pre>
                      )}
                      {row.ok && row.output && (
                        <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(row.output, null, 2)}
                        </pre>
                      )}
                      {row.ok && !row.output && row.output_text && (
                        <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {row.output_text}
                        </pre>
                      )}
                      {row.job_id === "builtin-deep-sleep" && row.ok && outputDay(row) !== "—" && (
                        <div className="mt-3">
                          <h4 className="font-semibold text-sm mb-1">深睡轮次日志</h4>
                          {roundsLoading && <p className="text-xs">加载轮次…</p>}
                          {!roundsLoading &&
                            rounds.map((r) => (
                              <div
                                key={r.round_index}
                                className="mb-2 border-t border-base-300 pt-2"
                              >
                                <p className="text-sm font-medium">
                                  {r.round_index}. {r.round} ({r.output.tool_calls} 次工具)
                                </p>
                                <p className="text-xs text-base-content/70">
                                  变更: +{r.change_log_snapshot.addedIds?.length ?? 0} / ~
                                  {r.change_log_snapshot.modifiedIds?.length ?? 0} / -
                                  {r.change_log_snapshot.deprecatedIds?.length ?? 0}
                                </p>
                                <p className="text-xs whitespace-pre-wrap">
                                  {r.output.summary.slice(0, 400)}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!runs.length && (
              <tr>
                <td colSpan={6} className="text-center text-base-content/50">
                  暂无 cron_log 记录（部署后新运行会写入）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  getDeepSleepRounds,
  getSleepBackfillStatus,
  getSleepPipelineStatus,
  getSleepSummary,
  listSleepRuns,
  startSleepBackfill,
  startSleepCycle,
  startSleepPipelineStep,
} from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

type DateField = string | Date | null | undefined;

type CronLogRow = {
  id: number;
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at: DateField;
  output: Record<string, unknown> | null;
  output_text: string | null;
  error: string | null;
};

type SleepSummaryView = {
  light_sleep: {
    last_day?: DateField;
    last_run_at?: DateField;
    stats?: { tool_calls?: number; sessions?: number };
  };
  deep_sleep: {
    last_day?: DateField;
    last_run_at?: DateField;
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

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDay(value: DateField): string {
  if (!value) return "—";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "—";
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  return value;
}

function formatTs(value: DateField): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function jobLabel(id: string) {
  if (id === "builtin-sleep-cycle") return m.webui_chamber_sleep_job_cycle();
  if (id === "builtin-light-sleep") return m.webui_chamber_sleep_light();
  if (id === "builtin-deep-sleep") return m.webui_chamber_sleep_deep();
  return id;
}

type PipelineStepState = {
  status: string;
  error?: string;
  skipped_reason?: string;
};

type PipelineStatus = {
  running: boolean;
  step_running: boolean;
  definition: { nodes: Array<{ id: string; dependsOn?: string[] }> };
  run_state: {
    day?: string;
    status?: string;
    steps?: Record<string, PipelineStepState>;
  } | null;
};

function outputDay(row: CronLogRow): string {
  const day = row.output?.day;
  if (typeof day === "string") return day;
  if (day instanceof Date) return formatDay(day);
  return "—";
}

function outputToolCalls(row: CronLogRow): string {
  if (!row.ok || !row.output) return "—";
  const total = row.output.total_tool_calls;
  const toolCalls = row.output.tool_calls;
  const n = typeof total === "number" ? total : typeof toolCalls === "number" ? toolCalls : null;
  return n != null ? String(n) : "—";
}

type BackfillStatus = {
  running: boolean;
  from_day?: string;
  to_day?: string;
  completed_days: string[];
  last_error_day?: string | null;
  updated_at?: string;
};

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
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillTo, setBackfillTo] = useState("");
  const [backfillResume, setBackfillResume] = useState(false);
  const [backfillStarting, setBackfillStarting] = useState(false);
  const [backfillError, setBackfillError] = useState("");
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const [pipelineDay, setPipelineDay] = useState("");
  const [pipelineStep, setPipelineStep] = useState("light-sleep");
  const [pipelineForce, setPipelineForce] = useState(false);
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSleepRuns({ limit: 50 });
      setRuns((data as { items?: CronLogRow[] }).items ?? []);
    } catch (e) {
      setError(
        m.webui_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPipelineStatus = useCallback(async () => {
    try {
      const status = (await getSleepPipelineStatus()) as PipelineStatus;
      setPipelineStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshPipelineStatus();
  }, [refreshPipelineStatus]);

  useEffect(() => {
    if (!pipelineStatus?.running && !pipelineStatus?.step_running) return;
    const timer = setInterval(() => {
      void refreshPipelineStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [pipelineStatus?.running, pipelineStatus?.step_running, refreshPipelineStatus]);

  useEffect(() => {
    if (pipelineStatus?.running || pipelineStatus?.step_running) return;
    if (!pipelineStatus?.run_state?.status) return;
    void reload();
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.run_state?.status,
    reload,
  ]);

  const startCycle = async () => {
    setPipelineStarting(true);
    setPipelineError("");
    try {
      await startSleepCycle({ day: pipelineDay.trim() || undefined });
      await refreshPipelineStatus();
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setPipelineStarting(false);
    }
  };

  const startStep = async () => {
    setPipelineStarting(true);
    setPipelineError("");
    try {
      await startSleepPipelineStep({
        step_id: pipelineStep,
        day: pipelineDay.trim() || undefined,
        force: pipelineForce,
      });
      await refreshPipelineStatus();
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setPipelineStarting(false);
    }
  };

  const refreshBackfillStatus = useCallback(async () => {
    try {
      const status = (await getSleepBackfillStatus()) as BackfillStatus;
      setBackfillStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshBackfillStatus();
  }, [refreshBackfillStatus]);

  useEffect(() => {
    if (!backfillStatus?.running) return;
    const timer = setInterval(() => {
      void refreshBackfillStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [backfillStatus?.running, refreshBackfillStatus]);

  useEffect(() => {
    if (backfillStatus?.running) return;
    if (!backfillStatus?.updated_at) return;
    void reload();
  }, [backfillStatus?.running, backfillStatus?.updated_at, reload]);

  const startBackfill = async () => {
    setBackfillStarting(true);
    setBackfillError("");
    try {
      await startSleepBackfill({
        from: backfillFrom.trim() || undefined,
        to: backfillTo.trim() || undefined,
        resume: backfillResume,
      });
      await refreshBackfillStatus();
    } catch (e) {
      setBackfillError(e instanceof Error ? e.message : String(e));
    } finally {
      setBackfillStarting(false);
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
    if (
      day !== "—" &&
      row.ok &&
      (row.job_id === "builtin-deep-sleep" || row.job_id === "builtin-sleep-cycle")
    ) {
      void loadRounds(day);
    } else {
      setRounds([]);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_sleep()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_sleep_desc()}</p>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="card bg-base-200 p-4">
            <h3 className="font-semibold mb-2">{m.webui_chamber_sleep_light_latest()}</h3>
            <p className="text-sm">
              {m.webui_common_processing_day()}: {formatDay(summary.light_sleep.last_day)}
            </p>
            <p className="text-sm">
              {m.webui_common_run_at()}: {formatTs(summary.light_sleep.last_run_at)}
            </p>
            <p className="text-sm">
              {m.webui_common_tool_calls()}: {summary.light_sleep.stats?.tool_calls ?? 0} ·{" "}
              {m.webui_common_sessions()}: {summary.light_sleep.stats?.sessions ?? 0}
            </p>
          </div>
          <div className="card bg-base-200 p-4">
            <h3 className="font-semibold mb-2">{m.webui_chamber_sleep_deep_latest()}</h3>
            <p className="text-sm">
              {m.webui_common_processing_day()}: {formatDay(summary.deep_sleep.last_day)}
            </p>
            <p className="text-sm">
              {m.webui_common_run_at()}: {formatTs(summary.deep_sleep.last_run_at)}
            </p>
            <p className="text-sm">
              {m.webui_common_tool_calls()}: {summary.deep_sleep.stats?.total_tool_calls ?? 0} ·{" "}
              {m.webui_common_rounds()}: {summary.deep_sleep.rounds_completed ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="card bg-base-200 p-4 mb-4">
        <h3 className="font-semibold mb-1">{m.webui_chamber_sleep_cycle_title()}</h3>
        <p className="text-sm text-base-content/60 mb-3">{m.webui_chamber_sleep_cycle_status()}</p>
        <label className="form-control mb-3 max-w-xs">
          <span className="label-text text-xs">{m.webui_chamber_sleep_cycle_day()}</span>
          <input
            type="text"
            className="input input-sm input-bordered"
            placeholder="YYYY-MM-DD"
            value={pipelineDay}
            onChange={(e) => setPipelineDay(e.target.value)}
            disabled={pipelineStatus?.running || pipelineStatus?.step_running || pipelineStarting}
          />
        </label>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pipelineStatus?.running || pipelineStatus?.step_running || pipelineStarting}
            onClick={() => void startCycle()}
          >
            {pipelineStatus?.running || pipelineStarting
              ? m.webui_chamber_sleep_cycle_running()
              : m.webui_chamber_sleep_cycle_run()}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 items-end">
          <label className="form-control">
            <span className="label-text text-xs">{m.webui_chamber_sleep_cycle_step()}</span>
            <select
              className="select select-sm select-bordered"
              value={pipelineStep}
              onChange={(e) => setPipelineStep(e.target.value)}
              disabled={pipelineStatus?.running || pipelineStatus?.step_running || pipelineStarting}
            >
              {(pipelineStatus?.definition?.nodes ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}
                </option>
              ))}
            </select>
          </label>
          <label className="label cursor-pointer justify-start gap-2 pb-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={pipelineForce}
              onChange={(e) => setPipelineForce(e.target.checked)}
              disabled={pipelineStatus?.running || pipelineStatus?.step_running || pipelineStarting}
            />
            <span className="label-text">{m.webui_chamber_sleep_cycle_force()}</span>
          </label>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={pipelineStatus?.running || pipelineStatus?.step_running || pipelineStarting}
            onClick={() => void startStep()}
          >
            {m.webui_chamber_sleep_cycle_step_run()}
          </button>
        </div>
        {pipelineStatus?.run_state?.steps && (
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>{m.webui_chamber_sleep_cycle_step()}</th>
                  <th>{m.webui_common_status()}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pipelineStatus.run_state.steps).map(([id, step]) => (
                  <tr key={id}>
                    <td>{id}</td>
                    <td>
                      {step.status}
                      {step.skipped_reason ? ` (${step.skipped_reason})` : ""}
                      {step.error ? ` — ${step.error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pipelineError && <p className="text-sm text-error mt-2">{pipelineError}</p>}
      </div>

      <div className="card bg-base-200 p-4 mb-4">
        <h3 className="font-semibold mb-1">{m.webui_chamber_sleep_backfill_title()}</h3>
        <p className="text-sm text-base-content/60 mb-3">{m.webui_chamber_sleep_backfill_desc()}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <label className="form-control">
            <span className="label-text text-xs">{m.webui_chamber_sleep_backfill_from()}</span>
            <input
              type="text"
              className="input input-sm input-bordered"
              placeholder="YYYY-MM-DD"
              value={backfillFrom}
              onChange={(e) => setBackfillFrom(e.target.value)}
              disabled={backfillStatus?.running || backfillStarting}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">{m.webui_chamber_sleep_backfill_to()}</span>
            <input
              type="text"
              className="input input-sm input-bordered"
              placeholder="YYYY-MM-DD"
              value={backfillTo}
              onChange={(e) => setBackfillTo(e.target.value)}
              disabled={backfillStatus?.running || backfillStarting}
            />
          </label>
        </div>
        <label className="label cursor-pointer justify-start gap-2 mb-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={backfillResume}
            onChange={(e) => setBackfillResume(e.target.checked)}
            disabled={backfillStatus?.running || backfillStarting}
          />
          <span className="label-text">{m.webui_chamber_sleep_backfill_resume()}</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={backfillStatus?.running || backfillStarting}
            onClick={() => void startBackfill()}
          >
            {backfillStarting || backfillStatus?.running
              ? m.webui_chamber_sleep_backfill_running()
              : m.webui_chamber_sleep_backfill_start()}
          </button>
          {backfillStatus && (
            <span className="text-sm text-base-content/70">
              {backfillStatus.running
                ? m.webui_chamber_sleep_backfill_running()
                : m.webui_chamber_sleep_backfill_done()}
              {" · "}
              {m.webui_chamber_sleep_backfill_progress({
                count: String(backfillStatus.completed_days.length),
              })}
              {backfillStatus.from_day && backfillStatus.to_day
                ? ` (${backfillStatus.from_day} → ${backfillStatus.to_day})`
                : ""}
            </span>
          )}
        </div>
        {backfillStatus?.last_error_day && (
          <p className="text-sm text-error mt-2">
            {m.webui_chamber_sleep_backfill_last_error({ day: backfillStatus.last_error_day })}
          </p>
        )}
        {backfillError && <p className="text-sm text-error mt-2">{backfillError}</p>}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? m.webui_common_refreshing() : m.webui_common_refresh_list()}
        </button>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{m.webui_common_time()}</th>
              <th>{m.webui_common_task()}</th>
              <th>{m.webui_common_processing_day()}</th>
              <th>{m.webui_common_status()}</th>
              <th>{m.webui_common_tools()}</th>
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
                  <td>{row.ok ? m.webui_common_success() : m.webui_common_failed()}</td>
                  <td>{outputToolCalls(row)}</td>
                  <td>
                    <button type="button" className="btn btn-xs" onClick={() => toggleExpand(row)}>
                      {expandedId === row.id ? m.webui_common_collapse() : m.webui_common_details()}
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
                      {(row.job_id === "builtin-deep-sleep" ||
                        row.job_id === "builtin-sleep-cycle") &&
                        row.ok &&
                        outputDay(row) !== "—" && (
                          <div className="mt-3">
                            <h4 className="font-semibold text-sm mb-1">
                              {m.webui_chamber_sleep_deep_rounds()}
                            </h4>
                            {roundsLoading && (
                              <p className="text-xs">{m.webui_chamber_sleep_loading_rounds()}</p>
                            )}
                            {!roundsLoading &&
                              rounds.map((r) => (
                                <div
                                  key={r.round_index}
                                  className="mb-2 border-t border-base-300 pt-2"
                                >
                                  <p className="text-sm font-medium">
                                    {m.webui_chamber_sleep_round_tools({
                                      index: String(r.round_index),
                                      round: r.round,
                                      count: String(r.output.tool_calls),
                                    })}
                                  </p>
                                  <p className="text-xs text-base-content/70">
                                    {m.webui_chamber_sleep_change_log({
                                      added: String(r.change_log_snapshot.addedIds?.length ?? 0),
                                      updated: String(
                                        r.change_log_snapshot.modifiedIds?.length ?? 0,
                                      ),
                                    })}{" "}
                                    / -{r.change_log_snapshot.deprecatedIds?.length ?? 0}
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
                  {m.webui_chamber_sleep_no_cron_log()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

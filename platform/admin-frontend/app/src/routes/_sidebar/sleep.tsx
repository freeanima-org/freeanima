import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/satellite-sdk/form";
import {
  getDeepSleepRounds,
  getSleepPipelineStatus,
  listPipelineStepRuns,
  startSleepCycle,
  startSleepPipelineStep,
} from "@admin/lib/api.ts";
import { formatDisplayDate, formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

type DateField = string | Date | null | undefined;

type PipelineRunRow = {
  id: number;
  pipeline_id: string;
  run_id: string;
  step_id: string;
  attempt: number;
  day: string;
  trigger: string;
  status: string;
  started_at: DateField;
  finished_at: DateField;
  output: Record<string, unknown> | null;
  error: string | null;
  skipped_reason: string | null;
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

export const Route = createFileRoute("/_sidebar/sleep")({
  loader: async () => {
    const runs = await listPipelineStepRuns({ limit: 50 }).catch(
      catchWithFallback("sleep/listPipelineStepRuns", { items: [] }),
    );
    return { runs: (runs as { items?: PipelineRunRow[] }).items ?? [] };
  },
  component: SleepPage,
});

function stepLabel(stepId: string): string {
  switch (stepId) {
    case "light-sleep":
      return m.admin_sleep_step_light_sleep();
    case "deep-sleep":
      return m.admin_sleep_step_deep_sleep();
    case "dream":
      return m.admin_sleep_step_dream();
    case "memory-ref-sync":
      return m.admin_sleep_step_memory_ref_sync();
    case "self-layer-refresh":
      return m.admin_sleep_step_self_layer_refresh();
    default:
      return stepId;
  }
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case "scheduled":
      return m.admin_sleep_trigger_scheduled();
    case "manual_cycle":
      return m.admin_sleep_trigger_manual_cycle();
    case "manual_step":
      return m.admin_sleep_trigger_manual_step();
    default:
      return trigger;
  }
}

function stepStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "running":
      return "badge-info";
    case "failed":
      return "badge-error";
    case "skipped":
      return "badge-warning";
    default:
      return "badge-ghost";
  }
}

function pipelineStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return m.admin_common_success();
    case "failed":
      return m.admin_common_failed();
    case "skipped":
      return status;
    default:
      return status;
  }
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

function outputToolCalls(output: Record<string, unknown> | null): string {
  if (!output) return "—";
  const total = output.total_tool_calls;
  const toolCalls = output.tool_calls;
  const n = typeof total === "number" ? total : typeof toolCalls === "number" ? toolCalls : null;
  return n != null ? String(n) : "—";
}

function SleepPage() {
  const initial = Route.useLoaderData() as {
    runs: PipelineRunRow[];
  };

  const [runs, setRuns] = useState(initial.runs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<DeepSleepRound[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [pipelineDay, setPipelineDay] = useState("");
  const [pipelineForce, setPipelineForce] = useState(false);
  const [deepSleepMode, setDeepSleepMode] = useState<"full" | "incremental">("full");
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  const reloadRuns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPipelineStepRuns({ limit: 50 });
      setRuns((data as { items?: PipelineRunRow[] }).items ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/sleep", e);
      setError(
        m.admin_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAfterRun = useCallback(async () => {
    await reloadRuns();
  }, [reloadRuns]);

  const refreshPipelineStatus = useCallback(async () => {
    try {
      const status = (await getSleepPipelineStatus()) as PipelineStatus;
      setPipelineStatus(status);
      return status;
    } catch (err) {
      logCaughtError("sleep/refreshPipelineStatus", err);
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
    if (
      pipelineStatus?.running ||
      pipelineStatus?.step_running ||
      pipelineStarting ||
      runningStepId
    ) {
      return;
    }
    if (!pipelineStatus?.run_state?.status && !runningStepId) return;
    void refreshAfterRun();
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.run_state?.status,
    pipelineStarting,
    runningStepId,
    refreshAfterRun,
  ]);

  const pipelineBusy =
    pipelineStatus?.running ||
    pipelineStatus?.step_running ||
    pipelineStarting ||
    Boolean(runningStepId);

  const startCycle = async () => {
    setPipelineStarting(true);
    setPipelineError("");
    try {
      await startSleepCycle({
        day: pipelineDay.trim() || undefined,
        deep_sleep_mode: deepSleepMode,
      });
      await refreshPipelineStatus();
    } catch (e) {
      logCaughtError("routes/_sidebar/sleep", e);
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setPipelineStarting(false);
    }
  };

  const startStep = async (stepId: string) => {
    setRunningStepId(stepId);
    setPipelineError("");
    try {
      await startSleepPipelineStep({
        step_id: stepId,
        day: pipelineDay.trim() || undefined,
        force: pipelineForce,
        deep_sleep_mode: stepId === "deep-sleep" ? deepSleepMode : undefined,
      });
      await refreshPipelineStatus();
      await refreshAfterRun();
    } catch (e) {
      logCaughtError("routes/_sidebar/sleep", e);
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningStepId(null);
    }
  };

  const loadRounds = useCallback(async (day: string) => {
    setRoundsLoading(true);
    try {
      const data = (await getDeepSleepRounds(day)) as { rounds?: DeepSleepRound[] };
      setRounds(data.rounds ?? []);
    } catch (err) {
      logCaughtError("sleep/loadDeepSleepRounds", err);
      setRounds([]);
    } finally {
      setRoundsLoading(false);
    }
  }, []);

  const toggleExpand = (row: PipelineRunRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      setRounds([]);
      return;
    }
    setExpandedId(row.id);
    if (row.step_id === "deep-sleep" && row.status === "completed" && row.day) {
      void loadRounds(row.day);
    } else {
      setRounds([]);
    }
  };

  const stepNodes = pipelineStatus?.definition?.nodes ?? [];
  const stepStates = pipelineStatus?.run_state?.steps ?? {};

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_sleep()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_sleep_desc()}</p>

      <div className="card bg-base-200 p-4 mb-4">
        <h3 className="font-semibold mb-1">{m.admin_sleep_cycle_title()}</h3>
        <p className="text-sm text-base-content/60 mb-3">{m.admin_sleep_cycle_status()}</p>
        <FormFieldset bordered={false} className="gap-3 mb-3">
          <FormField label={m.admin_sleep_cycle_day()} className="max-w-xs text-xs">
            <input
              type="text"
              className="input input-sm input-bordered"
              placeholder="YYYY-MM-DD"
              value={pipelineDay}
              onChange={(e) => setPipelineDay(e.target.value)}
              disabled={pipelineBusy}
            />
          </FormField>
          <div className="max-w-md">
            <FormFieldLabel className="text-xs py-0">
              {m.admin_sleep_deep_sleep_mode()}
            </FormFieldLabel>
            <select
              className="select select-sm select-bordered w-full"
              value={deepSleepMode}
              onChange={(e) => setDeepSleepMode(e.target.value as "full" | "incremental")}
              disabled={pipelineBusy}
            >
              <option value="full">{m.admin_sleep_deep_sleep_mode_full()}</option>
              <option value="incremental">{m.admin_sleep_deep_sleep_mode_incremental()}</option>
            </select>
          </div>
        </FormFieldset>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pipelineBusy}
            onClick={() => void startCycle()}
          >
            {pipelineStatus?.running || pipelineStarting
              ? m.admin_sleep_cycle_running()
              : m.admin_sleep_cycle_run()}
          </button>
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={pipelineForce}
              onChange={(e) => setPipelineForce(e.target.checked)}
              disabled={pipelineBusy}
            />
            <span className="text-sm">{m.admin_sleep_cycle_force()}</span>
          </label>
        </div>

        {stepNodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{m.admin_sleep_cycle_step()}</th>
                  <th>{m.admin_common_status()}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stepNodes.map((node) => {
                  const step = stepStates[node.id];
                  const status = step?.status ?? "pending";
                  const isRunningThis = runningStepId === node.id;
                  return (
                    <tr key={node.id}>
                      <td className="font-medium">{stepLabel(node.id)}</td>
                      <td>
                        <span className={`badge badge-sm ${stepStatusBadgeClass(status)}`}>
                          {status}
                        </span>
                        {step?.skipped_reason ? (
                          <span className="text-xs text-base-content/60 ml-1">
                            ({step.skipped_reason})
                          </span>
                        ) : null}
                        {step?.error ? (
                          <span className="text-xs text-error ml-1">— {step.error}</span>
                        ) : null}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-xs btn-secondary"
                          disabled={pipelineBusy}
                          onClick={() => void startStep(node.id)}
                        >
                          {isRunningThis
                            ? m.admin_sleep_cycle_running()
                            : m.admin_sleep_cycle_step_run()}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pipelineError && <p className="text-sm text-error mt-2">{pipelineError}</p>}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold flex-1">{m.admin_sleep_pipeline_history_title()}</h3>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void refreshAfterRun()}
        >
          {loading ? m.admin_common_refreshing() : m.admin_common_refresh_list()}
        </button>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{m.admin_common_time()}</th>
              <th>{m.admin_sleep_cycle_step()}</th>
              <th>{m.admin_sleep_trigger()}</th>
              <th>{m.admin_common_processing_day()}</th>
              <th>{m.admin_common_status()}</th>
              <th>{m.admin_sleep_attempt()}</th>
              <th>{m.admin_common_tools()}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((row) => (
              <Fragment key={row.id}>
                <tr className={row.status === "failed" ? "bg-error/10" : ""}>
                  <td className="whitespace-nowrap">{formatDisplayDateTime(row.finished_at)}</td>
                  <td>{stepLabel(row.step_id)}</td>
                  <td>{triggerLabel(row.trigger)}</td>
                  <td>{formatDisplayDate(row.day)}</td>
                  <td>
                    <span className={`badge badge-sm ${stepStatusBadgeClass(row.status)}`}>
                      {pipelineStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{row.attempt}</td>
                  <td>{outputToolCalls(row.output)}</td>
                  <td>
                    <button type="button" className="btn btn-xs" onClick={() => toggleExpand(row)}>
                      {expandedId === row.id ? m.admin_common_collapse() : m.admin_common_details()}
                    </button>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={8} className="bg-base-200">
                      {row.error && (
                        <pre className="text-xs text-error whitespace-pre-wrap break-all">
                          {row.error}
                        </pre>
                      )}
                      {row.skipped_reason && (
                        <p className="text-xs text-base-content/70 mb-2">{row.skipped_reason}</p>
                      )}
                      {row.output && (
                        <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(row.output, null, 2)}
                        </pre>
                      )}
                      {row.step_id === "deep-sleep" && row.status === "completed" && row.day && (
                        <div className="mt-3">
                          <h4 className="font-semibold text-sm mb-1">
                            {m.admin_sleep_deep_rounds()}
                          </h4>
                          {roundsLoading && (
                            <p className="text-xs">{m.admin_sleep_loading_rounds()}</p>
                          )}
                          {!roundsLoading &&
                            rounds.map((r) => (
                              <div
                                key={r.round_index}
                                className="mb-2 border-t border-base-300 pt-2"
                              >
                                <p className="text-sm font-medium">
                                  {m.admin_sleep_round_tools({
                                    index: String(r.round_index),
                                    round: r.round,
                                    count: String(r.output.tool_calls),
                                  })}
                                </p>
                                <p className="text-xs text-base-content/70">
                                  {m.admin_sleep_change_log({
                                    added: String(r.change_log_snapshot.addedIds?.length ?? 0),
                                    updated: String(r.change_log_snapshot.modifiedIds?.length ?? 0),
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
                <td colSpan={8} className="text-center text-base-content/50">
                  {m.admin_sleep_no_runs()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

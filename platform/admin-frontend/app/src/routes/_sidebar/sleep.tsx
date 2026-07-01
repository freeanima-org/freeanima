import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form";
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

type BadgeVariant = "success" | "secondary" | "destructive" | "warning" | "ghost";

function stepStatusBadgeVariant(status: string | undefined): BadgeVariant {
  switch (status) {
    case "completed":
      return "success";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    case "skipped":
      return "warning";
    default:
      return "ghost";
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
      await startSleepCycle(
        omitUndefined({
          day: pipelineDay.trim() || undefined,
          deep_sleep_mode: deepSleepMode,
        }),
      );
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
      await startSleepPipelineStep(
        omitUndefined({
          step_id: stepId,
          day: pipelineDay.trim() || undefined,
          force: pipelineForce,
          deep_sleep_mode: stepId === "deep-sleep" ? deepSleepMode : undefined,
        }),
      );
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
      <p className="text-sm text-muted-foreground mb-4">{m.admin_sleep_desc()}</p>

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-1">{m.admin_sleep_cycle_title()}</h3>
          <p className="text-sm text-muted-foreground mb-3">{m.admin_sleep_cycle_status()}</p>
          <FormFieldset bordered={false} className="gap-3 mb-3">
            <FormField label={m.admin_sleep_cycle_day()} className="max-w-xs text-xs">
              <Input
                type="text"
                className="h-8"
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
              <Select
                value={deepSleepMode}
                onValueChange={(v) => setDeepSleepMode(v as "full" | "incremental")}
                disabled={pipelineBusy}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{m.admin_sleep_deep_sleep_mode_full()}</SelectItem>
                  <SelectItem value="incremental">
                    {m.admin_sleep_deep_sleep_mode_incremental()}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormFieldset>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Button
              type="button"
              size="sm"
              disabled={pipelineBusy}
              onClick={() => void startCycle()}
            >
              {pipelineStatus?.running || pipelineStarting
                ? m.admin_sleep_cycle_running()
                : m.admin_sleep_cycle_run()}
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="pipeline-force"
                checked={pipelineForce}
                disabled={pipelineBusy}
                onCheckedChange={(checked) => setPipelineForce(checked === true)}
              />
              <Label htmlFor="pipeline-force" className="text-sm">
                {m.admin_sleep_cycle_force()}
              </Label>
            </div>
          </div>

          {stepNodes.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.admin_sleep_cycle_step()}</TableHead>
                    <TableHead>{m.admin_common_status()}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stepNodes.map((node) => {
                    const step = stepStates[node.id];
                    const status = step?.status ?? "pending";
                    const isRunningThis = runningStepId === node.id;
                    return (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">{stepLabel(node.id)}</TableCell>
                        <TableCell>
                          <Badge variant={stepStatusBadgeVariant(status)} className="text-xs">
                            {status}
                          </Badge>
                          {step?.skipped_reason ? (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({step.skipped_reason})
                            </span>
                          ) : null}
                          {step?.error ? (
                            <span className="text-xs text-destructive ml-1">— {step.error}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={pipelineBusy}
                            onClick={() => void startStep(node.id)}
                          >
                            {isRunningThis
                              ? m.admin_sleep_cycle_running()
                              : m.admin_sleep_cycle_step_run()}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {pipelineError && <p className="text-sm text-destructive mt-2">{pipelineError}</p>}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold flex-1">{m.admin_sleep_pipeline_history_title()}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void refreshAfterRun()}
        >
          {loading ? m.admin_common_refreshing() : m.admin_common_refresh_list()}
        </Button>
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.admin_common_time()}</TableHead>
              <TableHead>{m.admin_sleep_cycle_step()}</TableHead>
              <TableHead>{m.admin_sleep_trigger()}</TableHead>
              <TableHead>{m.admin_common_processing_day()}</TableHead>
              <TableHead>{m.admin_common_status()}</TableHead>
              <TableHead>{m.admin_sleep_attempt()}</TableHead>
              <TableHead>{m.admin_common_tools()}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((row) => (
              <Fragment key={row.id}>
                <TableRow className={row.status === "failed" ? "bg-destructive/10" : ""}>
                  <TableCell className="whitespace-nowrap">
                    {formatDisplayDateTime(row.finished_at)}
                  </TableCell>
                  <TableCell>{stepLabel(row.step_id)}</TableCell>
                  <TableCell>{triggerLabel(row.trigger)}</TableCell>
                  <TableCell>{formatDisplayDate(row.day)}</TableCell>
                  <TableCell>
                    <Badge variant={stepStatusBadgeVariant(row.status)} className="text-xs">
                      {pipelineStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.attempt}</TableCell>
                  <TableCell>{outputToolCalls(row.output)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleExpand(row)}
                    >
                      {expandedId === row.id ? m.admin_common_collapse() : m.admin_common_details()}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === row.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted">
                      {row.error && (
                        <pre className="text-xs text-destructive whitespace-pre-wrap break-all">
                          {row.error}
                        </pre>
                      )}
                      {row.skipped_reason && (
                        <p className="text-xs text-muted-foreground mb-2">{row.skipped_reason}</p>
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
                              <div key={r.round_index} className="mb-2 border-t border pt-2">
                                <p className="text-sm font-medium">
                                  {m.admin_sleep_round_tools({
                                    index: String(r.round_index),
                                    round: r.round,
                                    count: String(r.output.tool_calls),
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
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
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {m.admin_sleep_no_runs()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import {
  getSleepPipelineStatus,
  listPipelineStepRuns,
  startSleepCatchUp,
  startSleepCycle,
  startSleepPipelineStep,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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

type DeepSleepRoundRow = {
  round: string;
  round_index: number;
  tool_calls: number;
  summary: string;
  change_log_snapshot: {
    addedIds?: string[];
    modifiedIds?: string[];
    deprecatedIds?: string[];
  };
};

function deepSleepRoundsFromOutput(output: Record<string, unknown> | null): DeepSleepRoundRow[] {
  if (!output || !Array.isArray(output.rounds)) return [];

  const rounds: DeepSleepRoundRow[] = [];
  for (const item of output.rounds) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.round !== "string" || typeof row.round_index !== "number") continue;

    const snapshot =
      typeof row.change_log_snapshot === "object" && row.change_log_snapshot !== null
        ? (row.change_log_snapshot as Record<string, unknown>)
        : {};

    rounds.push({
      round: row.round,
      round_index: row.round_index,
      tool_calls: typeof row.tool_calls === "number" ? row.tool_calls : 0,
      summary: typeof row.summary === "string" ? row.summary : "",
      change_log_snapshot: {
        addedIds: Array.isArray(snapshot.addedIds) ? (snapshot.addedIds as string[]) : [],
        modifiedIds: Array.isArray(snapshot.modifiedIds) ? (snapshot.modifiedIds as string[]) : [],
        deprecatedIds: Array.isArray(snapshot.deprecatedIds)
          ? (snapshot.deprecatedIds as string[])
          : [],
      },
    });
  }
  return rounds;
}

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
    case "retain-catch-up":
    case "light-sleep":
      return "Retain 补跑";
    case "reflect":
    case "deep-sleep":
      return "Reflect 巩固";
    case "dream":
      return "梦境（已废止）";
    case "memory-ref-sync":
      return "引用同步（已废止）";
    case "conversation-cleanup":
      return "会话清理";
    case "temporal-summary-day":
      return "日编年";
    case "temporal-summary-cascade":
      return "编年级联";
    case "self-layer-refresh":
      return "自我层刷新";
    default:
      return stepId;
  }
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case "scheduled":
      return "已调度";
    case "manual_cycle":
      return "手动周期";
    case "manual_step":
      return "手动步骤";
    case "catch_up":
      return "补跑";
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
      return "成功";
    case "failed":
      return "失败";
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

type CatchUpStatus = {
  running: boolean;
  plan: {
    light_days: string[];
    temporal_days: string[];
    cascade_days: string[];
    days: string[];
  } | null;
  completed_light_days: string[];
  completed_temporal_days: string[];
  completed_cascade_days: string[];
  current_day: string | null;
  current_step: string | null;
  error: string | null;
  finished: boolean;
};

type PipelineStatus = {
  running: boolean;
  step_running: boolean;
  catch_up_running?: boolean;
  definition: { nodes: Array<{ id: string; dependsOn?: string[] }> };
  run_state: {
    day?: string;
    status?: string;
    steps?: Record<string, PipelineStepState>;
  } | null;
  catch_up?: CatchUpStatus;
};

function outputToolCalls(output: Record<string, unknown> | null): string {
  if (!output) return "—";
  const total = output.total_tool_calls;
  const toolCalls = output.tool_calls;
  const n = typeof total === "number" ? total : typeof toolCalls === "number" ? toolCalls : null;
  return n != null ? String(n) : "—";
}

function SleepPage() {
  const initial = Route.useLoaderData();

  const [runs, setRuns] = useState(initial.runs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pipelineDay, setPipelineDay] = useState("");
  const [pipelineForce, setPipelineForce] = useState(false);
  const [deepSleepMode, setDeepSleepMode] = useState<"full" | "incremental">("full");
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const [catchUpStarting, setCatchUpStarting] = useState(false);
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
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
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
    if (
      !pipelineStatus?.running &&
      !pipelineStatus?.step_running &&
      !pipelineStatus?.catch_up_running
    ) {
      return () => {};
    }
    const timer = setInterval(() => {
      void refreshPipelineStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.catch_up_running,
    refreshPipelineStatus,
  ]);

  useEffect(() => {
    if (
      pipelineStatus?.running ||
      pipelineStatus?.step_running ||
      pipelineStatus?.catch_up_running ||
      pipelineStarting ||
      catchUpStarting ||
      runningStepId
    ) {
      return;
    }
    if (!pipelineStatus?.run_state?.status && !pipelineStatus?.catch_up?.finished) return;
    void refreshAfterRun();
  }, [
    pipelineStatus?.running,
    pipelineStatus?.step_running,
    pipelineStatus?.catch_up_running,
    pipelineStatus?.run_state?.status,
    pipelineStatus?.catch_up?.finished,
    pipelineStarting,
    catchUpStarting,
    runningStepId,
    refreshAfterRun,
  ]);

  const pipelineBusy =
    pipelineStatus?.running ||
    pipelineStatus?.step_running ||
    pipelineStatus?.catch_up_running ||
    pipelineStarting ||
    catchUpStarting ||
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

  const startCatchUp = async () => {
    setCatchUpStarting(true);
    setPipelineError("");
    try {
      await startSleepCatchUp();
      await refreshPipelineStatus();
    } catch (e) {
      logCaughtError("routes/_sidebar/sleep", e);
      setPipelineError(e instanceof Error ? e.message : String(e));
    } finally {
      setCatchUpStarting(false);
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
          deep_sleep_mode:
            stepId === "deep-sleep" || stepId === "reflect" ? deepSleepMode : undefined,
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

  const toggleExpand = (row: PipelineRunRow) => {
    setExpandedId(expandedId === row.id ? null : row.id);
  };

  const stepNodes = pipelineStatus?.definition?.nodes ?? [];
  const stepStates = pipelineStatus?.run_state?.steps ?? {};
  const catchUp = pipelineStatus?.catch_up;
  const catchUpTotal =
    (catchUp?.plan?.light_days.length ?? 0) +
    (catchUp?.plan?.temporal_days.length ?? 0) +
    (catchUp?.plan?.cascade_days.length ?? 0);
  const catchUpDone =
    (catchUp?.completed_light_days.length ?? 0) +
    (catchUp?.completed_temporal_days.length ?? 0) +
    (catchUp?.completed_cascade_days.length ?? 0);
  const catchUpCurrent =
    catchUp?.current_step && catchUp.current_day
      ? `${catchUp.current_step} @ ${catchUp.current_day}`
      : (catchUp?.current_day ?? "—");

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{"记忆维护"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"维护管线状态、手动运行与步骤历史（原睡眠周期；巩固已迁 retain/reflect）。"}
      </p>

      <Card className="bg-muted py-0 mb-4">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-1">{"运行控制"}</h3>
          <p className="text-sm text-muted-foreground mb-3">{"步骤状态"}</p>
          <FormFieldset bordered={false} className="gap-3 mb-3">
            <FormField label={"日期（YYYY-MM-DD，可选）"} className="max-w-xs text-xs">
              <DatePickerInput
                className="h-8"
                value={pipelineDay}
                aria-label={"日期（YYYY-MM-DD，可选）"}
                onChange={setPipelineDay}
                disabled={pipelineBusy}
              />
            </FormField>
            <div className="max-w-md">
              <FormFieldLabel className="text-xs py-0">{"Reflect 模式"}</FormFieldLabel>
              <Select
                selectedKey={deepSleepMode}
                onSelectionChange={(key) => {
                  if (key != null) setDeepSleepMode(String(key) as "full" | "incremental");
                }}
                isDisabled={pipelineBusy}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id="full">{"完整（全部轮次、全部记忆）"}</SelectItem>
                  <SelectItem id="incremental">{"增量（跳过静默轮次）"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormFieldset>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Button
              type="button"
              size="sm"
              isDisabled={pipelineBusy}
              onClick={() => void startCycle()}
            >
              {pipelineStatus?.running || pipelineStarting ? "睡眠周期运行中…" : "运行完整周期"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isDisabled={pipelineBusy}
              onClick={() => void startCatchUp()}
              title={"从最早活动日补到今天：缺浅睡的天跑浅睡，缺全局天摘要的天补时间摘要。"}
            >
              {pipelineStatus?.catch_up_running || catchUpStarting ? "补睡眠运行中…" : "一键补睡眠"}
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="pipeline-force"
                isSelected={pipelineForce}
                isDisabled={pipelineBusy}
                onChange={(checked) => setPipelineForce(checked)}
              />
              <Label htmlFor="pipeline-force" className="text-sm">
                {"强制（跳过依赖检查）"}
              </Label>
            </div>
          </div>
          {(pipelineStatus?.catch_up_running || catchUp?.finished) && catchUpTotal > 0 ? (
            <p className="text-xs text-muted-foreground mb-3">
              {`补睡眠：${catchUpCurrent}（${String(catchUpDone)}/${String(catchUpTotal)}）`}
              {catchUp?.error ? (
                <span className="text-destructive ml-1">— {catchUp.error}</span>
              ) : null}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mb-3">
            {"从最早活动日补到今天：缺浅睡的天跑浅睡，缺全局天摘要的天补时间摘要。"}
          </p>

          {stepNodes.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{"步骤"}</TableHead>
                    <TableHead>{"状态"}</TableHead>
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
                            isDisabled={pipelineBusy}
                            onClick={() => void startStep(node.id)}
                          >
                            {isRunningThis ? "睡眠周期运行中…" : "运行"}
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
        <h3 className="font-semibold flex-1">{"流水线历史"}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={loading}
          onClick={() => void refreshAfterRun()}
        >
          {loading ? "刷新中…" : "刷新列表"}
        </Button>
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{"时间"}</TableHead>
              <TableHead>{"步骤"}</TableHead>
              <TableHead>{"触发"}</TableHead>
              <TableHead>{"处理日"}</TableHead>
              <TableHead>{"状态"}</TableHead>
              <TableHead>{"尝试次数"}</TableHead>
              <TableHead>{"工具"}</TableHead>
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
                      {expandedId === row.id ? "收起" : "详情"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === row.id &&
                  (() => {
                    const deepSleepRounds =
                      row.step_id === "deep-sleep" && row.status === "completed"
                        ? deepSleepRoundsFromOutput(row.output)
                        : [];
                    return (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted">
                          {row.error && (
                            <pre className="text-xs text-destructive whitespace-pre-wrap break-all">
                              {row.error}
                            </pre>
                          )}
                          {row.skipped_reason && (
                            <p className="text-xs text-muted-foreground mb-2">
                              {row.skipped_reason}
                            </p>
                          )}
                          {row.output && (
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                              {JSON.stringify(row.output, null, 2)}
                            </pre>
                          )}
                          {deepSleepRounds.length > 0 && (
                            <div className="mt-3">
                              <h4 className="font-semibold text-sm mb-1">{"深睡轮次日志"}</h4>
                              {deepSleepRounds.map((r) => (
                                <div key={r.round_index} className="mb-2 border-t border pt-2">
                                  <p className="text-sm font-medium">
                                    {`${String(r.round_index)}. ${r.round} (${String(r.tool_calls)} 次工具)`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {`变更: +${String(r.change_log_snapshot.addedIds?.length ?? 0)} / ~${String(
                                      r.change_log_snapshot.modifiedIds?.length ?? 0,
                                    )}`}{" "}
                                    / -{r.change_log_snapshot.deprecatedIds?.length ?? 0}
                                  </p>
                                  <p className="text-xs whitespace-pre-wrap">
                                    {r.summary.slice(0, 400)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })()}
              </Fragment>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {"尚无运行记录"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

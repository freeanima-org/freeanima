import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import type { Key } from "react-aria-components";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import {
  backfillMissingTemporalSummaries,
  getTemporalBatchJobStatus,
  getTemporalSystemRollBatchStatus,
  listTemporalSummaries,
  listTemporalSystemRolls,
  regenerateTemporalSummary,
  rebuildTemporalSummariesInRange,
  startTemporalSystemRollBatch,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";

const PAGE_SIZE = 20;
const POLL_MS = 2000;
const ENTITY_TABS = ["day", "month", "year"] as const;
type EntityWindow = (typeof ENTITY_TABS)[number];
type PageTab = EntityWindow | "system_rolls";
type ToolbarOp = "list" | "batch" | "regen";

type TemporalRow = {
  id: number;
  window: EntityWindow;
  period_start: string;
  content: string;
  content_chars: number;
  empty_reason: string | null;
  source_count: number | null;
  updated_at: string;
};

type SystemRollRow = {
  kind: "past_days" | "past_months" | "past_years";
  anchor: string;
  label: string;
  cache_hit: boolean;
  summary: string;
  sources_fp: string | null;
  created_at: string | null;
  source_count: number;
  redis_key: string;
};

type TemporalBatchJobStatus = {
  running: boolean;
  mode: "backfill_missing" | "rebuild_range" | null;
  window: EntityWindow | null;
  period_start_from: string | null;
  period_start_to: string | null;
  current: number;
  total: number;
  current_period: string | null;
  completed: string[];
  failed: Array<{ period_start: string; summary: string }>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: string | null;
};

type TemporalSystemRollBatchJobStatus = {
  running: boolean;
  kinds: Array<"past_days" | "past_months" | "past_years"> | null;
  current: number;
  total: number;
  current_kind: "past_days" | "past_months" | "past_years" | null;
  completed: Array<"past_days" | "past_months" | "past_years">;
  failed: Array<{ kind: string; summary: string }>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: string | null;
};

export const Route = createFileRoute("/_sidebar/temporal-summary")({
  component: TemporalSummaryPage,
});

function formatRatio(current: number, total: number): string {
  return `${current}/${total}`;
}

/** 按窗口把区间值规范成后端期望的 period_start（月=YYYY-MM-01，年=YYYY-01-01） */
function normalizeRangeValue(value: string, window: EntityWindow): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(trimmed);
  if (!m) return trimmed;
  const y = m[1] ?? "";
  const month = m[2] ?? "";
  if (!y || !month) return trimmed;
  if (window === "year") return `${y}-01-01`;
  if (window === "month") return `${y}-${month}-01`;
  if (m[3]) return `${y}-${month}-${m[3]}`;
  return `${y}-${month}-01`;
}

/** 表格 / 进度里按粒度展示 period_start */
function formatPeriodStartLabel(value: string, window: EntityWindow): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(trimmed);
  if (!m) return trimmed;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : null;
  if (window === "year") return `${y}年`;
  if (window === "month") return `${y}年${month}月`;
  if (day != null) return `${y}年${month}月${day}日`;
  return `${y}年${month}月`;
}

function periodColumnLabel(window: EntityWindow): string {
  if (window === "year") return "年份";
  if (window === "month") return "月份";
  return "日期";
}

function EntityBatchProgress({ job }: { job: TemporalBatchJobStatus }) {
  if (!job.running && !job.error && !job.summary && job.finished_at == null) return null;
  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  const modeLabel =
    job.mode === "backfill_missing"
      ? "补全缺失"
      : job.mode === "rebuild_range"
        ? "强制重跑"
        : "批量";
  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-2">
      <h3 className="font-bold text-sm">{"批量进度"}</h3>
      {job.running ? (
        <>
          <p className="text-sm">
            {modeLabel}
            {job.window ? ` · ${job.window}` : ""}
            {" · "}
            {formatRatio(job.current, job.total)}
            {job.current_period && job.window
              ? ` · 当前 ${formatPeriodStartLabel(job.current_period, job.window)}`
              : job.current_period
                ? ` · 当前 ${job.current_period}`
                : ""}
          </p>
          <progress className="w-full h-2 accent-primary" value={pct} max={100} />
          <p className="text-xs text-muted-foreground">
            {"后台运行中，可关闭页面；刷新后仍可继续查看进度。"}
          </p>
        </>
      ) : null}
      {!job.running && job.summary ? (
        <p className="text-sm">
          {modeLabel}
          {"完成："}
          {job.summary}
          {job.failed.length > 0 ? `（失败 ${String(job.failed.length)}）` : ""}
        </p>
      ) : null}
      {job.error ? <StatusAlert variant="error">{job.error}</StatusAlert> : null}
    </div>
  );
}

function RollBatchProgress({ job }: { job: TemporalSystemRollBatchJobStatus }) {
  if (!job.running && !job.error && !job.summary && job.finished_at == null) return null;
  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : 0;
  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-2">
      <h3 className="font-bold text-sm">{"系统汇总进度"}</h3>
      {job.running ? (
        <>
          <p className="text-sm">
            {"重新生成 · "}
            {formatRatio(job.current, job.total)}
            {job.current_kind ? ` · 当前 ${job.current_kind}` : ""}
          </p>
          <progress className="w-full h-2 accent-primary" value={pct} max={100} />
          <p className="text-xs text-muted-foreground">
            {"后台运行中，可关闭页面；刷新后仍可继续查看进度。"}
          </p>
        </>
      ) : null}
      {!job.running && job.summary ? (
        <p className="text-sm">
          {"完成："}
          {job.summary}
          {job.failed.length > 0 ? `（失败 ${String(job.failed.length)}）` : ""}
        </p>
      ) : null}
      {job.error ? <StatusAlert variant="error">{job.error}</StatusAlert> : null}
    </div>
  );
}

function TemporalSummaryPage() {
  const [tab, setTab] = useState<PageTab>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TemporalRow[]>([]);
  const [rolls, setRolls] = useState<SystemRollRow[]>([]);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  const [batchJob, setBatchJob] = useState<TemporalBatchJobStatus | null>(null);
  const [rollBatchJob, setRollBatchJob] = useState<TemporalSystemRollBatchJobStatus | null>(null);
  const opRef = useRef<ToolbarOp | null>(null);
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchRunning = batchJob?.running === true;
  const rollBatchRunning = rollBatchJob?.running === true;
  const toolbarBusy = listLoading || batchRunning || rollBatchRunning || regenKey != null;

  const fetchEntityList = useCallback(
    async (
      window: EntityWindow,
      nextOffset: number,
      opts?: { silent?: boolean; claimOp?: boolean },
    ) => {
      const silent = opts?.silent === true;
      const claimOp = opts?.claimOp !== false && !silent;
      if (claimOp) {
        if (opRef.current) return;
        opRef.current = "list";
        setListLoading(true);
      }
      if (!silent) setError("");
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
        const data = (await listTemporalSummaries(
          omitUndefined({
            window,
            period_start_from: from.trim() ? normalizeRangeValue(from, window) : undefined,
            period_start_to: to.trim() ? normalizeRangeValue(to, window) : undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
          }),
        )) as { items: TemporalRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
      } catch (e) {
        logCaughtError("routes/_sidebar/temporal-summary", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (claimOp) {
          setListLoading(false);
          if (opRef.current === "list") opRef.current = null;
        }
      }
    },
    [from, setOffset, to],
  );

  const fetchRolls = useCallback(async (opts?: { silent?: boolean; claimOp?: boolean }) => {
    const silent = opts?.silent === true;
    const claimOp = opts?.claimOp !== false && !silent;
    if (claimOp) {
      if (opRef.current) return;
      opRef.current = "list";
      setListLoading(true);
    }
    if (!silent) setError("");
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
      const data = (await listTemporalSystemRolls()) as { items: SystemRollRow[] };
      setRolls(data.items ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/system-rolls", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (claimOp) {
        setListLoading(false);
        if (opRef.current === "list") opRef.current = null;
      }
    }
  }, []);

  const stopBatchPoll = useCallback(() => {
    if (batchPollRef.current) {
      clearInterval(batchPollRef.current);
      batchPollRef.current = null;
    }
  }, []);

  const stopRollPoll = useCallback(() => {
    if (rollPollRef.current) {
      clearInterval(rollPollRef.current);
      rollPollRef.current = null;
    }
  }, []);

  const onBatchFinished = useCallback(
    async (job: TemporalBatchJobStatus) => {
      if (opRef.current === "batch") opRef.current = null;
      if (job.error) {
        setError(job.error);
        setInfo("");
      } else {
        setInfo(
          `${job.mode === "rebuild_range" ? "强制重跑" : "补全"}完成：${job.summary ?? ""}${
            job.failed.length > 0 ? `；失败 ${String(job.failed.length)}` : ""
          }`,
        );
      }
      const window = job.window ?? (tab === "system_rolls" ? "day" : tab);
      await fetchEntityList(window, 0, { silent: true });
    },
    [fetchEntityList, tab],
  );

  const onRollBatchFinished = useCallback(
    async (job: TemporalSystemRollBatchJobStatus) => {
      if (opRef.current === "batch") opRef.current = null;
      if (job.error) {
        setError(job.error);
        setInfo("");
      } else {
        setInfo(
          `系统汇总完成：${job.summary ?? ""}${
            job.failed.length > 0 ? `；失败 ${String(job.failed.length)}` : ""
          }`,
        );
      }
      await fetchRolls({ silent: true });
    },
    [fetchRolls],
  );

  const pollBatchJob = useCallback(async () => {
    try {
      const next = await getTemporalBatchJobStatus();
      setBatchJob(next);
      if (!next.running) {
        stopBatchPoll();
        await onBatchFinished(next);
      }
    } catch (err) {
      logCaughtError("routes/_sidebar/temporal-summary/poll-batch", err);
    }
  }, [onBatchFinished, stopBatchPoll]);

  const pollRollBatchJob = useCallback(async () => {
    try {
      const next = await getTemporalSystemRollBatchStatus();
      setRollBatchJob(next);
      if (!next.running) {
        stopRollPoll();
        await onRollBatchFinished(next);
      }
    } catch (err) {
      logCaughtError("routes/_sidebar/temporal-summary/poll-roll-batch", err);
    }
  }, [onRollBatchFinished, stopRollPoll]);
  const startBatchPolling = useCallback(() => {
    if (batchPollRef.current) return;
    batchPollRef.current = setInterval(() => void pollBatchJob(), POLL_MS);
  }, [pollBatchJob]);

  const startRollPolling = useCallback(() => {
    if (rollPollRef.current) return;
    rollPollRef.current = setInterval(() => void pollRollBatchJob(), POLL_MS);
  }, [pollRollBatchJob]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [entityStatus, rollStatus] = await Promise.all([
          getTemporalBatchJobStatus(),
          getTemporalSystemRollBatchStatus(),
        ]);
        if (cancelled) return;
        setBatchJob(entityStatus);
        setRollBatchJob(rollStatus);
        if (entityStatus.running) {
          opRef.current = "batch";
          startBatchPolling();
        }
        if (rollStatus.running) {
          opRef.current = "batch";
          startRollPolling();
        }
      } catch (err) {
        logCaughtError("routes/_sidebar/temporal-summary/resume-jobs", err);
      }
    })();
    return () => {
      cancelled = true;
      stopBatchPoll();
      stopRollPoll();
    };
  }, [startBatchPolling, startRollPolling, stopBatchPoll, stopRollPoll]);

  useEffect(() => {
    if (tab === "system_rolls") {
      void fetchRolls();
      return;
    }
    void fetchEntityList(tab, 0);
  }, [tab, fetchEntityList, fetchRolls]);

  const onRegenerateEntity = async (row: TemporalRow) => {
    if (opRef.current) return;
    const key = `${row.window}:${row.period_start}`;
    opRef.current = "regen";
    setRegenKey(key);
    setError("");
    setInfo("");
    try {
      const result = (await regenerateTemporalSummary({
        window: row.window,
        period_start: row.period_start,
      })) as { ok?: boolean; summary?: string };
      if (result.ok === false) {
        setError(result.summary || "重新生成失败");
        return;
      }
      await fetchEntityList(row.window, offsetForPage(currentPage), { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/regen", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenKey(null);
      if (opRef.current === "regen") opRef.current = null;
    }
  };

  const onBackfillMissing = async (window: EntityWindow) => {
    const period_start_from = from.trim();
    const period_start_to = to.trim();
    if (!period_start_from || !period_start_to) {
      setError(
        window === "year"
          ? "补全缺失周期前请同时设置起止年份。"
          : window === "month"
            ? "补全缺失周期前请同时设置起止月份。"
            : "补全缺失周期前请同时设置起止日期（YYYY-MM-DD）。",
      );
      return;
    }
    if (opRef.current) return;
    opRef.current = "batch";
    setError("");
    setInfo("");
    try {
      const started = await backfillMissingTemporalSummaries({
        window,
        period_start_from: normalizeRangeValue(period_start_from, window),
        period_start_to: normalizeRangeValue(period_start_to, window),
      });
      setBatchJob(started);
      if (started.running) {
        startBatchPolling();
      } else {
        await onBatchFinished(started);
      }
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/backfill", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      if (opRef.current === "batch") opRef.current = null;
    }
  };

  const onRebuildRange = async (window: EntityWindow) => {
    const period_start_from = from.trim();
    const period_start_to = to.trim();
    if (!period_start_from || !period_start_to) {
      setError(
        window === "year"
          ? "强制重跑前请同时设置起止年份。"
          : window === "month"
            ? "强制重跑前请同时设置起止月份。"
            : "强制重跑前请同时设置起止日期（YYYY-MM-DD）。",
      );
      return;
    }
    if (opRef.current) return;
    opRef.current = "batch";
    setError("");
    setInfo("");
    try {
      const started = await rebuildTemporalSummariesInRange({
        window,
        period_start_from: normalizeRangeValue(period_start_from, window),
        period_start_to: normalizeRangeValue(period_start_to, window),
      });
      setBatchJob(started);
      if (started.running) {
        startBatchPolling();
      } else {
        await onBatchFinished(started);
      }
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/rebuild", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      if (opRef.current === "batch") opRef.current = null;
    }
  };

  const onRegenerateRoll = async (kind: SystemRollRow["kind"]) => {
    if (opRef.current) return;
    opRef.current = "batch";
    setError("");
    setInfo("");
    try {
      const started = await startTemporalSystemRollBatch({
        kinds: [kind],
      });
      setRollBatchJob(started);
      if (started.running) {
        startRollPolling();
      } else {
        await onRollBatchFinished(started);
      }
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-regen", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      if (opRef.current === "batch") opRef.current = null;
    }
  };

  const onBackfillMissingRolls = async () => {
    if (opRef.current) return;
    const missing = rolls.filter((r) => !r.cache_hit || !r.summary.trim()).map((r) => r.kind);
    if (missing.length === 0) {
      setInfo("没有缺失的系统汇总。");
      return;
    }
    opRef.current = "batch";
    setError("");
    setInfo("");
    try {
      const started = await startTemporalSystemRollBatch({
        kinds: missing,
      });
      setRollBatchJob(started);
      if (started.running) {
        startRollPolling();
      } else {
        await onRollBatchFinished(started);
      }
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-backfill", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      if (opRef.current === "batch") opRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{"⏳ 时间摘要"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {
            "全局日/月/年实体（各周期结束后写入），以及三条反向系统汇总（过往日/月/年），经 Redis 缓存。计入所有非 debug、非 cron 会话（含 remote）；全局日按消息时间选源。「补全缺失」只填没有行的周期；「强制重跑」覆盖区间内全部期望周期（含空占位）。批量任务在后台执行，页面轮询进度。"
          }
        </p>
      </div>

      {batchJob ? <EntityBatchProgress job={batchJob} /> : null}
      {rollBatchJob ? <RollBatchProgress job={rollBatchJob} /> : null}

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key: Key) => {
          if (key == null) return;
          const next = String(key);
          if (next === "month" || next === "year" || next === "day") {
            setFrom((prev) => normalizeRangeValue(prev, next));
            setTo((prev) => normalizeRangeValue(prev, next));
            setTab(next);
          } else if (next === "system_rolls") {
            setTab(next);
          }
        }}
        className="space-y-4"
      >
        <TabsList className="w-fit flex-wrap h-auto">
          {ENTITY_TABS.map((w) => (
            <TabsTrigger key={w} id={w}>
              {w === "day" ? "日" : w === "month" ? "月" : "年"}
            </TabsTrigger>
          ))}
          <TabsTrigger id="system_rolls">{"系统汇总"}</TabsTrigger>
        </TabsList>

        {ENTITY_TABS.map((w) => (
          <TabsContent key={w} id={w} className="space-y-4">
            <FormFieldset className="space-y-0">
              <div className="flex flex-wrap items-end gap-3">
                <FormField
                  label={w === "day" ? "From" : w === "month" ? "起始月" : "起始年"}
                  className="min-w-40"
                >
                  <DatePickerInput
                    value={from}
                    aria-label={w === "day" ? "From" : w === "month" ? "起始月" : "起始年"}
                    granularity={w}
                    onChange={setFrom}
                  />
                </FormField>
                <FormField
                  label={w === "day" ? "To" : w === "month" ? "结束月" : "结束年"}
                  className="min-w-40"
                >
                  <DatePickerInput
                    value={to}
                    aria-label={w === "day" ? "To" : w === "month" ? "结束月" : "结束年"}
                    granularity={w}
                    onChange={setTo}
                  />
                </FormField>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void fetchEntityList(w, 0)}
                    isDisabled={toolbarBusy}
                  >
                    {listLoading ? <Spinner className="size-4" /> : null}
                    {"查询"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onBackfillMissing(w)}
                    isDisabled={toolbarBusy}
                  >
                    {batchRunning && batchJob?.mode === "backfill_missing" ? (
                      <Spinner className="size-4" />
                    ) : null}
                    {"补全缺失"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onRebuildRange(w)}
                    isDisabled={toolbarBusy}
                  >
                    {batchRunning && batchJob?.mode === "rebuild_range" ? (
                      <Spinner className="size-4" />
                    ) : null}
                    {"强制重跑"}
                  </Button>
                </div>
              </div>
            </FormFieldset>

            {error && tab === w ? <StatusAlert variant="error">{error}</StatusAlert> : null}
            {info && tab === w ? <StatusAlert variant="info">{info}</StatusAlert> : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-32">{periodColumnLabel(w)}</TableHead>
                  <TableHead className="w-20">{"字符数"}</TableHead>
                  <TableHead className="w-20">{"来源"}</TableHead>
                  <TableHead className="w-28">{"为空原因"}</TableHead>
                  <TableHead>content</TableHead>
                  <TableHead className="w-40">updated</TableHead>
                  <TableHead className="w-28">{"操作"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-sm">
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const key = `${row.window}:${row.period_start}`;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.id}</TableCell>
                        <TableCell className="text-xs">
                          {formatPeriodStartLabel(row.period_start, row.window)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.content_chars}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.source_count ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.empty_reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap max-w-xl">
                          {row.content || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDisplayDateTime(row.updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            isDisabled={toolbarBusy}
                            onClick={() => void onRegenerateEntity(row)}
                          >
                            {regenKey === key ? <Spinner className="size-3" /> : null}
                            {"重新生成"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <MemoryListPagination
              currentPage={currentPage}
              total={total}
              pageSize={PAGE_SIZE}
              loading={toolbarBusy}
              onPageChange={(page) => void fetchEntityList(w, offsetForPage(page))}
            />
          </TabsContent>
        ))}

        <TabsContent id="system_rolls" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {
              "提示词注入汇总：过往日（本月今天之前）、过往月（本年本月之前）、过往年（本年之前）。每条 ≤100 字（硬上限 1.5×）；仅在 Redis 有对应缓存时列出。"
            }
          </p>
          {error && tab === "system_rolls" ? (
            <StatusAlert variant="error">{error}</StatusAlert>
          ) : null}
          {info && tab === "system_rolls" ? <StatusAlert variant="info">{info}</StatusAlert> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchRolls()}
              isDisabled={toolbarBusy}
            >
              {listLoading ? <Spinner className="size-4" /> : null}
              {"查询"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onBackfillMissingRolls()}
              isDisabled={toolbarBusy}
            >
              {rollBatchRunning ? <Spinner className="size-4" /> : null}
              {"补全缺失"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{"汇总类型"}</TableHead>
                <TableHead className="w-28">anchor</TableHead>
                <TableHead className="w-24">{"缓存"}</TableHead>
                <TableHead className="w-20">sources</TableHead>
                <TableHead>summary</TableHead>
                <TableHead className="w-40">created</TableHead>
                <TableHead className="w-28">{"操作"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-sm">
                    —
                  </TableCell>
                </TableRow>
              ) : (
                rolls.map((row) => (
                  <TableRow key={row.kind}>
                    <TableCell className="text-xs">{row.label}</TableCell>
                    <TableCell className="font-mono text-xs">{row.anchor}</TableCell>
                    <TableCell className="text-xs">{row.cache_hit ? "命中" : "未命中"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.source_count}</TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap max-w-xl">
                      {row.summary || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.created_at ? formatDisplayDateTime(row.created_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isDisabled={toolbarBusy}
                        onClick={() => void onRegenerateRoll(row.kind)}
                      >
                        {rollBatchRunning && rollBatchJob?.current_kind === row.kind ? (
                          <Spinner className="size-3" />
                        ) : null}
                        {"重新生成"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

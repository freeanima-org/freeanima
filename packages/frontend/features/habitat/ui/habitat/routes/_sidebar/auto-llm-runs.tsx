import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
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
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { getAutoLlmRun, listAutoLlmRuns } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";
import {
  emptyLlmUsageTotals,
  formatTokenK,
  formatUsageTriplet,
  usageRecordToTotals,
  type LlmUsageTotals,
} from "@freeanima/shared/llm-usage";

const PAGE_SIZE = 20;
const RUNNING_POLL_MS = 2000;

const RUN_KIND_LABELS: Record<string, string> = {
  cron: "定时任务",
  "memory-retain": "记忆 Retain",
  "memory-reflect": "记忆 Reflect",
  "self-autobiography": "自我自传",
  "self-layer-refresh": "自我层刷新",
  "temporal-summary": "时间摘要",
  "skill-evolve": "技能演化",
  "skill-maintain": "技能维护",
  "conversation-title": "对话标题",
  "goal-judge": "目标判定",
  "compression-summary": "压缩摘要",
  "handoff-summary": "交接摘要",
  subagent: "子代理",
  "semantic-cluster-title": "语义簇标题",
};

const RUN_KIND_OPTIONS = ["", ...Object.keys(RUN_KIND_LABELS)] as const;

const STATUS_LABELS: Record<string, string> = {
  running: "进行中",
  ok: "成功",
  error: "失败",
};

const TEMPERATURE_TIER_LABELS: Record<string, string> = {
  focused: "专注",
  balanced: "平衡",
  creative: "发散",
};

/** 与 run_kind 重复的布尔标记，不展示 */
const DROPPED_META_KEYS = new Set(["retain", "reflect", "temporal_summary", "self_layer_refresh"]);

const CONSUMED_META_KEYS = new Set([
  ...DROPPED_META_KEYS,
  "model",
  "request_params",
  "tool_names",
  "temperature_tier",
  "parent_conversation_id",
  "job_id",
  "slug",
  "kind",
  "subagent_entity_id",
  "round",
  "gate_reason",
  "profile_id",
  "format",
]);

const ALL_VALUE = "__all__";

type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number | null;
  output: string;
  status: string;
  duration_ms: number;
  max_loop_iterations?: number;
  max_duration_ms?: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string | null;
  usage?: LlmUsageTotals;
};

type AutoLlmMessageRow = {
  id: string;
  run_id: string;
  pos: number;
  payload: {
    role: string;
    content?: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{ id?: string; function?: { name?: string } }>;
    usage?: Record<string, number>;
  };
};

function runKindLabel(kind: string): string {
  return RUN_KIND_LABELS[kind] ?? kind;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function temperatureTierLabel(tier: string): string {
  return TEMPERATURE_TIER_LABELS[tier] ?? tier;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec} s`;
}

function rowUsage(row: AutoLlmRunRow): LlmUsageTotals {
  return row.usage ?? emptyLlmUsageTotals();
}

function messageUsageLabel(msg: AutoLlmMessageRow): string | null {
  if (msg.payload.role !== "assistant") return null;
  const totals = usageRecordToTotals(msg.payload.usage);
  return totals ? formatUsageTriplet(totals) : null;
}

function rowDurationMs(row: AutoLlmRunRow, nowMs: number): number {
  if (row.status !== "running") return row.duration_ms;
  const start = Date.parse(row.created_at);
  if (!Number.isFinite(start)) return row.duration_ms;
  return Math.max(0, nowMs - start);
}

function formatMessagePreview(msg: AutoLlmMessageRow): string {
  const role = msg.payload.role;
  const content =
    typeof msg.payload.content === "string" ? msg.payload.content : (msg.payload.content ?? "");
  const preview = content.length > 800 ? `${content.slice(0, 800)}…` : content;
  if (role === "tool") {
    return `[tool ${msg.payload.tool_call_id ?? ""}] ${preview}`;
  }
  const toolCalls = msg.payload.tool_calls;
  if ((!preview || !preview.trim()) && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const names = toolCalls.map((tc) => tc.function?.name ?? tc.id ?? "?").join(", ");
    return `[${role}] tool_calls: ${names}`;
  }
  return `[${role}] ${preview}`;
}

function messageContentText(msg: AutoLlmMessageRow): string {
  const content = msg.payload.content;
  return typeof content === "string" ? content : content == null ? "" : String(content);
}

function lastSuccessfulAssistantFromMessages(msgs: AutoLlmMessageRow[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.payload.role !== "assistant") continue;
    if (Array.isArray(m.payload.tool_calls) && m.payload.tool_calls.length > 0) continue;
    const content = typeof m.payload.content === "string" ? m.payload.content.trim() : "";
    if (content) return content;
  }
  return "";
}

function formatMetaValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = v;
  return out;
}

function toolNamesFromMeta(meta: Record<string, unknown> | null): string[] {
  const raw = meta?.tool_names;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is string => typeof n === "string" && n.length > 0);
}

function requestParamsFromMeta(
  meta: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return asRecord(meta?.request_params);
}

type KvRow = { key: string; label: string; value: string };

function DetailKv({ rows }: { rows: KvRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{"无"}</p>;
  }
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map((row) => (
        <Fragment key={row.key}>
          <dt className="text-muted-foreground shrink-0">{row.label}</dt>
          <dd className="font-mono whitespace-pre-wrap break-all min-w-0">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function buildRunInfoRows(row: AutoLlmRunRow): KvRow[] {
  const meta = row.metadata ?? {};
  const rows: KvRow[] = [
    { key: "id", label: "id", value: row.id },
    { key: "run_name", label: "运行名称", value: row.run_name },
    { key: "run_kind", label: "运行类型", value: runKindLabel(row.run_kind) },
    {
      key: "subject_id",
      label: "主体",
      value: row.subject_id == null ? "—" : String(row.subject_id),
    },
  ];
  const parentId = asString(meta.parent_conversation_id);
  if (parentId) {
    rows.push({ key: "parent_conversation_id", label: "关联对话", value: parentId });
  }
  const jobId = asString(meta.job_id);
  if (jobId) {
    rows.push({ key: "job_id", label: "定时任务", value: jobId });
  }
  const slug = asString(meta.slug);
  if (slug) {
    rows.push({ key: "slug", label: "子代理", value: slug });
  }
  const archiveBits = [
    asString(meta.kind),
    asNumber(meta.subagent_entity_id) != null ? `#${String(meta.subagent_entity_id)}` : undefined,
  ].filter((v): v is string => Boolean(v));
  if (archiveBits.length > 0) {
    rows.push({ key: "archive", label: "档案", value: archiveBits.join(" · ") });
  }
  const round = asNumber(meta.round);
  if (round != null) {
    rows.push({ key: "round", label: "Reflect 轮次", value: String(round) });
  }
  const gateReason = asString(meta.gate_reason);
  if (gateReason) {
    rows.push({ key: "gate_reason", label: "门控原因", value: gateReason });
  }
  const toolNames = toolNamesFromMeta(row.metadata);
  if (toolNames.length > 0) {
    rows.push({ key: "tool_names", label: "允许工具", value: toolNames.join(", ") });
  }
  const tier = asString(meta.temperature_tier);
  if (tier) {
    rows.push({ key: "temperature_tier", label: "采样档位", value: temperatureTierLabel(tier) });
  }
  rows.push({
    key: "max_loop_iterations",
    label: "引擎轮预算",
    value: row.max_loop_iterations == null ? "—" : String(row.max_loop_iterations),
  });
  rows.push({
    key: "max_duration_ms",
    label: "墙钟预算",
    value: row.max_duration_ms == null ? "—" : formatDurationMs(row.max_duration_ms),
  });
  rows.push({
    key: "created_at",
    label: "开始时间",
    value: formatDisplayDateTime(row.created_at),
  });
  rows.push({
    key: "finished_at",
    label: "结束时间",
    value: row.finished_at ? formatDisplayDateTime(row.finished_at) : "—",
  });

  for (const [key, value] of Object.entries(meta)) {
    if (CONSUMED_META_KEYS.has(key)) continue;
    if (value == null) continue;
    rows.push({ key: `extra:${key}`, label: key, value: formatMetaValue(value) });
  }
  return rows;
}

function buildCallConfigRows(row: AutoLlmRunRow): KvRow[] {
  const meta = row.metadata ?? {};
  const params = requestParamsFromMeta(row.metadata);
  const rows: KvRow[] = [];
  const model = asString(meta.model);
  if (model) {
    rows.push({ key: "model", label: "模型", value: model });
  }
  if (params) {
    if (asNumber(params.temperature) != null) {
      rows.push({ key: "temperature", label: "temperature", value: String(params.temperature) });
    }
    if (asNumber(params.topP) != null) {
      rows.push({ key: "topP", label: "topP", value: String(params.topP) });
    }
    if (asNumber(params.maxOutputTokens) != null) {
      rows.push({
        key: "maxOutputTokens",
        label: "maxOutputTokens",
        value: String(params.maxOutputTokens),
      });
    }
    const extra = asRecord(params.extra);
    if (extra) {
      if (extra.thinking != null) {
        rows.push({ key: "thinking", label: "thinking", value: formatMetaValue(extra.thinking) });
      }
      if (extra.reasoning != null) {
        rows.push({
          key: "reasoning",
          label: "reasoning",
          value: formatMetaValue(extra.reasoning),
        });
      }
    }
  }
  const profileId = asString(meta.profile_id);
  if (profileId) {
    rows.push({ key: "profile_id", label: "profile", value: profileId });
  }
  const format = asString(meta.format);
  if (format) {
    rows.push({ key: "format", label: "format", value: format });
  }
  return rows;
}

function DetailFold({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const label = count != null ? `${title} (${String(count)})` : title;
  return (
    <details
      className="group mb-2 rounded-md border border-border bg-background/40"
      open={defaultOpen}
    >
      <summary className="text-xs font-semibold cursor-pointer select-none list-none flex items-center gap-2 px-2.5 py-1.5 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground group-open:rotate-90 transition-transform inline-block">
          ▸
        </span>
        {label}
      </summary>
      <div className="px-2.5 pb-2.5 pt-0.5">{children}</div>
    </details>
  );
}

export const Route = createFileRoute("/_sidebar/auto-llm-runs")({
  component: AutoLlmRunsPage,
});

function AutoLlmRunsPage() {
  const [runKind, setRunKind] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { offset, setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AutoLlmRunRow[]>([]);
  const [usageTotals, setUsageTotals] = useState<LlmUsageTotals>(() => emptyLlmUsageTotals());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<AutoLlmMessageRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchList = useCallback(
    async (nextOffset: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError("");
      try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
        const data = (await listAutoLlmRuns(
          omitUndefined({
            run_kind: runKind || undefined,
            status:
              statusFilter === "ok" || statusFilter === "error" || statusFilter === "running"
                ? statusFilter
                : undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
          }),
        )) as { items: AutoLlmRunRow[]; total: number; usage_totals?: LlmUsageTotals };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setUsageTotals(data.usage_totals ?? emptyLlmUsageTotals());
        setOffset(nextOffset);
        setLoaded(true);
        setNowMs(Date.now());
      } catch (e) {
        logCaughtError("routes/_sidebar/auto-llm-runs", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [runKind, statusFilter, setOffset],
  );

  useEffect(() => {
    void fetchList(0);
  }, [fetchList]);

  const loadDetail = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setDetailLoading(true);
      setDetailMessages([]);
    }
    try {
      const data = (await getAutoLlmRun(id)) as {
        run?: AutoLlmRunRow;
        messages?: AutoLlmMessageRow[];
      } | null;
      setDetailMessages(data?.messages ?? []);
      if (data?.run) {
        const next = data.run;
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
      }
    } catch (e) {
      logCaughtError("routes/_sidebar/auto-llm-runs/get", e);
      if (!opts?.silent) setDetailMessages([]);
    } finally {
      if (!opts?.silent) setDetailLoading(false);
    }
  }, []);

  const expandedRow = expandedId ? (items.find((r) => r.id === expandedId) ?? null) : null;
  const hasRunning = items.some((r) => r.status === "running") || expandedRow?.status === "running";

  useEffect(() => {
    if (!hasRunning) return undefined;
    const timer = setInterval(() => {
      setNowMs(Date.now());
      void fetchList(offset, { silent: true });
      if (expandedId) void loadDetail(expandedId, { silent: true });
    }, RUNNING_POLL_MS);
    return () => clearInterval(timer);
  }, [hasRunning, offset, expandedId, fetchList, loadDetail]);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetailMessages([]);
      return;
    }
    setExpandedId(id);
    void loadDetail(id);
  };

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{"🤖 自动 LLM 运行"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {
          "非对话 LLM 运行审计（定时任务、记忆维护、标题生成、goal 判定、压缩摘要等）。与对话 messages 互斥。"
        }
      </p>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <FormField label={"运行类型"} className="w-full max-w-xs text-xs">
          <Select
            selectedKey={runKind || ALL_VALUE}
            onSelectionChange={(key) => {
              if (key == null) return;
              const v = String(key);
              setRunKind(v === ALL_VALUE ? "" : v);
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem id={ALL_VALUE}>{"全部"}</SelectItem>
              {RUN_KIND_OPTIONS.filter(Boolean).map((kind) => (
                <SelectItem key={kind} id={kind} textValue={runKindLabel(kind)}>
                  {runKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={"状态"} className="w-full max-w-xs text-xs">
          <Select
            selectedKey={statusFilter || ALL_VALUE}
            onSelectionChange={(key) => {
              if (key == null) return;
              const v = String(key);
              setStatusFilter(v === ALL_VALUE ? "" : v);
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem id={ALL_VALUE}>{"全部"}</SelectItem>
              <SelectItem id="running">{"进行中"}</SelectItem>
              <SelectItem id="ok">{"成功"}</SelectItem>
              <SelectItem id="error">{"失败"}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <Button type="button" size="sm" onClick={runSearch} isDisabled={loading}>
          {loading ? "加载中…" : "刷新"}
        </Button>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {loaded && items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">{"尚无 AutoLlmRun 记录。"}</p>
      ) : null}

      {loaded ? (
        <p className="text-xs text-muted-foreground mb-2 font-mono">
          {`当前筛选合计：${formatUsageTriplet(usageTotals)}`}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{"开始时间"}</TableHead>
                <TableHead>{"运行名称"}</TableHead>
                <TableHead>{"运行类型"}</TableHead>
                <TableHead>{"状态"}</TableHead>
                <TableHead>{"时长"}</TableHead>
                <TableHead>{"限额"}</TableHead>
                <TableHead className="text-right">{"缓存入"}</TableHead>
                <TableHead className="text-right">{"未缓存入"}</TableHead>
                <TableHead className="text-right">{"出"}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const displayOutput =
                  row.output ||
                  (expandedId === row.id
                    ? lastSuccessfulAssistantFromMessages(detailMessages)
                    : "");
                return (
                  <Fragment key={row.id}>
                    <TableRow className={row.status === "error" ? "bg-destructive/10" : ""}>
                      <TableCell className="whitespace-nowrap">
                        {formatDisplayDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate" title={row.run_name}>
                        {row.run_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="ghost" className="text-xs" title={row.run_kind}>
                          {runKindLabel(row.run_kind)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "ok"
                              ? "success"
                              : row.status === "running"
                                ? "warning"
                                : "destructive"
                          }
                          className="text-xs"
                          title={row.status}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDurationMs(rowDurationMs(row, nowMs))}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {row.max_loop_iterations != null
                          ? `${row.max_loop_iterations} 引擎轮`
                          : "—"}
                        {row.max_duration_ms != null
                          ? ` / ≤${formatDurationMs(row.max_duration_ms)}`
                          : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatTokenK(rowUsage(row).cached_input_tokens)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatTokenK(rowUsage(row).uncached_input_tokens)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatTokenK(rowUsage(row).output_tokens)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleExpand(row.id)}
                        >
                          {expandedId === row.id ? "收起" : "详情"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === row.id ? (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted">
                          {row.status === "error" && row.error ? (
                            <pre className="text-xs text-destructive whitespace-pre-wrap break-all mb-2">
                              {row.error}
                            </pre>
                          ) : null}
                          {displayOutput ? (
                            <div className="mb-2">
                              <p className="text-xs font-semibold mb-1">{"输出"}</p>
                              <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                                {displayOutput}
                              </pre>
                            </div>
                          ) : null}
                          <DetailFold title={"运行信息"} defaultOpen>
                            <DetailKv rows={buildRunInfoRows(row)} />
                          </DetailFold>
                          <p className="text-xs text-muted-foreground font-mono mb-2">
                            {`合计 ${formatUsageTriplet(rowUsage(row))}`}
                          </p>
                          {buildCallConfigRows(row).length > 0 ? (
                            <DetailFold title={"调用配置"}>
                              <DetailKv rows={buildCallConfigRows(row)} />
                            </DetailFold>
                          ) : null}
                          {(() => {
                            const systemMsgs = detailMessages.filter(
                              (m) => m.payload.role === "system",
                            );
                            const otherMsgs = detailMessages.filter(
                              (m) => m.payload.role !== "system",
                            );
                            return (
                              <>
                                <DetailFold title={"系统提示词"} count={systemMsgs.length}>
                                  {detailLoading ? (
                                    <p className="text-xs text-muted-foreground">{"加载中…"}</p>
                                  ) : systemMsgs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      {"此运行无 system 消息。"}
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {systemMsgs.map((m) => (
                                        <pre
                                          key={m.id}
                                          className="text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto"
                                        >
                                          {messageContentText(m) || "(空)"}
                                        </pre>
                                      ))}
                                    </div>
                                  )}
                                </DetailFold>
                                <DetailFold title={"消息列表"} count={otherMsgs.length}>
                                  {detailLoading ? (
                                    <p className="text-xs text-muted-foreground">{"加载中…"}</p>
                                  ) : otherMsgs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      {"此运行无非 system 消息。"}
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {otherMsgs.map((m) => {
                                        const role = m.payload.role || "?";
                                        const full = formatMessagePreview(m);
                                        const preview =
                                          full.length > 120 ? `${full.slice(0, 120)}…` : full;
                                        const usageLabel = messageUsageLabel(m);
                                        return (
                                          <details
                                            key={m.id}
                                            className="group rounded border border-border/70 bg-background/50"
                                          >
                                            <summary className="text-xs cursor-pointer select-none list-none flex items-start gap-2 px-2 py-1.5 [&::-webkit-details-marker]:hidden">
                                              <span className="text-muted-foreground group-open:rotate-90 transition-transform inline-block shrink-0 mt-0.5">
                                                ▸
                                              </span>
                                              <span className="font-mono shrink-0 text-muted-foreground">
                                                {`#${String(m.pos)} ${role}`}
                                              </span>
                                              {usageLabel ? (
                                                <span className="font-mono shrink-0 text-[10px] text-muted-foreground">
                                                  {usageLabel}
                                                </span>
                                              ) : null}
                                              <span className="truncate min-w-0 text-muted-foreground font-normal">
                                                {preview}
                                              </span>
                                            </summary>
                                            <pre className="text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto px-2 pb-2">
                                              {messageContentText(m) || full || "(空)"}
                                            </pre>
                                          </details>
                                        );
                                      })}
                                    </div>
                                  )}
                                </DetailFold>
                              </>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {total > PAGE_SIZE ? (
        <MemoryListPagination
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}

import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useState } from "react";
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

const PAGE_SIZE = 20;

const RUN_KIND_OPTIONS = [
  "",
  "cron",
  "light-sleep",
  "deep-sleep",
  "dream",
  "autobiography",
  "temporal-summary",
  "skill-evolve",
  "skill-maintain",
  "conversation-title",
  "goal-judge",
  "compression-summary",
  "handoff-summary",
  "subagent",
] as const;

const ALL_VALUE = "__all__";

type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  subject_id: number | null;
  input_summary: string;
  output: string;
  status: string;
  duration_ms: number;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string;
};

type AutoLlmMessageRow = {
  id: string;
  run_id: string;
  pos: number;
  payload: {
    role: string;
    content?: string | null;
    tool_call_id?: string;
  };
};

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec} s`;
}

function formatMessagePreview(msg: AutoLlmMessageRow): string {
  const role = msg.payload.role;
  const content =
    typeof msg.payload.content === "string" ? msg.payload.content : (msg.payload.content ?? "");
  const preview = content.length > 800 ? `${content.slice(0, 800)}…` : content;
  if (role === "tool") {
    return `[tool ${msg.payload.tool_call_id ?? ""}] ${preview}`;
  }
  return `[${role}] ${preview}`;
}

export const Route = createFileRoute("/_sidebar/auto-llm-runs")({
  component: AutoLlmRunsPage,
});

function AutoLlmRunsPage() {
  const [runKind, setRunKind] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AutoLlmRunRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<AutoLlmMessageRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listAutoLlmRuns(
          omitUndefined({
            run_kind: runKind || undefined,
            status: statusFilter === "ok" || statusFilter === "error" ? statusFilter : undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
          }),
        )) as { items: AutoLlmRunRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/auto-llm-runs", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [runKind, statusFilter, setOffset],
  );

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailMessages([]);
    try {
      const data = (await getAutoLlmRun(id)) as {
        run?: AutoLlmRunRow;
        messages?: AutoLlmMessageRow[];
      } | null;
      setDetailMessages(data?.messages ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/auto-llm-runs/get", e);
      setDetailMessages([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
          "非对话 LLM 运行审计（定时任务、睡眠、标题生成、goal 判定、压缩摘要等）。与对话 messages 互斥。"
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
                <SelectItem key={kind} id={kind}>
                  {kind}
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

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{"时间"}</TableHead>
                <TableHead>{"运行名称"}</TableHead>
                <TableHead>{"运行类型"}</TableHead>
                <TableHead>{"状态"}</TableHead>
                <TableHead>{"时长"}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <Fragment key={row.id}>
                  <TableRow className={row.status === "ok" ? "" : "bg-destructive/10"}>
                    <TableCell className="whitespace-nowrap">
                      {formatDisplayDateTime(row.finished_at)}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={row.run_name}>
                      {row.run_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="ghost" className="text-xs font-mono">
                        {row.run_kind}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "ok" ? "success" : "destructive"}
                        className="text-xs"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDurationMs(row.duration_ms)}
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
                      <TableCell colSpan={6} className="bg-muted">
                        <p className="text-xs font-mono text-muted-foreground mb-2 break-all">
                          {row.id}
                          {row.subject_id != null ? ` · subject_id=${row.subject_id}` : ""}
                        </p>
                        {row.input_summary ? (
                          <div className="mb-2">
                            <p className="text-xs font-semibold mb-1">{"输入摘要"}</p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                              {row.input_summary}
                            </pre>
                          </div>
                        ) : null}
                        {row.status === "error" && row.error ? (
                          <pre className="text-xs text-destructive whitespace-pre-wrap break-all mb-2">
                            {row.error}
                          </pre>
                        ) : null}
                        {row.output ? (
                          <div className="mb-2">
                            <p className="text-xs font-semibold mb-1">{"输出"}</p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                              {row.output}
                            </pre>
                          </div>
                        ) : null}
                        <div className="mb-2">
                          <p className="text-xs font-semibold mb-1">{"消息"}</p>
                          {detailLoading ? (
                            <p className="text-xs text-muted-foreground">{"加载中…"}</p>
                          ) : detailMessages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{"此运行无消息轨迹。"}</p>
                          ) : (
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">
                              {detailMessages.map(formatMessagePreview).join("\n\n")}
                            </pre>
                          )}
                        </div>
                        {row.metadata && Object.keys(row.metadata).length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-1">{"元数据"}</p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
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

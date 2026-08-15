import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SemanticMemoryRow } from "@freeanima/shared/db-shapes";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetHeader,
  SheetTitle,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { MemoryConsolidationDialog } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryConsolidationDialog.tsx";
import { PassiveRecallDebugPanel } from "@freeanima/features/habitat/ui/habitat/components/habitat/PassiveRecallDebugPanel.tsx";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  listSemanticMemories,
  listSemanticMemoryClusters,
  updateSemanticMemoryPinned,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useMemoryPipeline } from "@freeanima/features/habitat/ui/habitat/lib/use-memory-pipeline.ts";

const PAGE_SIZE = 20;
const ALL_VALUE = "__all__";
const UNGROUPED_VALUE = "__ungrouped__";
const CLUSTER_CALIBRATE_STEP = "semantic-cluster-calibrate";

const SEMANTIC_TYPES = [
  "world",
  "experience",
  "opinion",
  "observation",
  "preference",
  "procedural",
  "imprint",
] as const;

const BROWSE_SORT_OPTIONS = ["updated_at", "created_at", "reference_count"] as const;
type BrowseSortBy = (typeof BROWSE_SORT_OPTIONS)[number];

type SemanticRow = SemanticMemoryRow & { rank?: number; cluster_id?: number | null };

type ClusterStat = { cluster_id: number | null; count: number };

function clusterFilterKey(clusterFilter: number | null | undefined): string {
  if (clusterFilter === undefined) return ALL_VALUE;
  if (clusterFilter === null) return UNGROUPED_VALUE;
  return String(clusterFilter);
}

function parseClusterFilterKey(key: string): number | null | undefined {
  if (key === ALL_VALUE) return undefined;
  if (key === UNGROUPED_VALUE) return null;
  const n = Number(key);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function formatClusterLabel(clusterId: number | null | undefined): string {
  if (clusterId == null) return "未分组";
  return `族 ${clusterId}`;
}

export const Route = createFileRoute("/_sidebar/semantic-memory")({
  validateSearch: (search: Record<string, unknown>): { passive?: "1" } =>
    omitUndefined({
      passive:
        search.passive === "1" || search.passive === 1 || search.passive === true
          ? ("1" as const)
          : undefined,
    }),
  component: SemanticMemoryPage,
});

function SemanticMemoryPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { passive } = Route.useSearch();
  const [passiveOpen, setPassiveOpen] = useState(passive === "1");
  const [consolidationOpen, setConsolidationOpen] = useState(false);

  useEffect(() => {
    setPassiveOpen(passive === "1");
  }, [passive]);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceConversation, setSourceConversation] = useState("");
  const [clusterFilter, setClusterFilter] = useState<number | null | undefined>(undefined);
  const [sortBy, setSortBy] = useState<BrowseSortBy>("updated_at");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<SemanticRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasSearchQuery, setHasSearchQuery] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [clusterStats, setClusterStats] = useState<ClusterStat[]>([]);

  const loadedRef = useRef(false);
  const offsetRef = useRef(0);
  const fetchListRef = useRef<
    (nextOffset: number, clusterOverride?: number | null) => Promise<void>
  >(async () => {});
  const refreshClusterStatsRef = useRef<() => Promise<void>>(async () => {});

  const { pipelineError, pipelineBusy, runningStepId, startStep, setPipelineError } =
    useMemoryPipeline({
      logScope: "semantic-memory/cluster-calibrate",
      onSettled: () => {
        void refreshClusterStatsRef.current();
        if (loadedRef.current) void fetchListRef.current(offsetRef.current);
      },
    });

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const calibrating = runningStepId === CLUSTER_CALIBRATE_STEP;
  const ungroupedCount = clusterStats.find((s) => s.cluster_id == null)?.count;

  const setPassiveSheetOpen = (open: boolean) => {
    setPassiveOpen(open);
    void navigate({
      search: (prev) => omitUndefined({ ...prev, passive: open ? ("1" as const) : undefined }),
      replace: true,
    });
  };

  const refreshClusterStats = useCallback(async () => {
    try {
      const data = await listSemanticMemoryClusters();
      setClusterStats(data.items ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/semantic-memory/clusters", e);
    }
  }, []);

  useEffect(() => {
    refreshClusterStatsRef.current = refreshClusterStats;
  }, [refreshClusterStats]);

  useEffect(() => {
    void refreshClusterStats();
  }, [refreshClusterStats]);

  const fetchList = useCallback(
    async (nextOffset: number, clusterOverride?: number | null) => {
      setLoading(true);
      setError("");
      const trimmedQuery = query.trim();
      const effectiveSortBy = trimmedQuery ? "rank" : sortBy;
      const effectiveCluster = clusterOverride !== undefined ? clusterOverride : clusterFilter;
      try {
        const data = (await listSemanticMemories({
          offset: nextOffset,
          limit: PAGE_SIZE,
          status: statusFilter === "all" ? "all" : statusFilter,
          sort_by: effectiveSortBy,
          ...omitUndefined({
            query: trimmedQuery || undefined,
            types: typeFilter ? [typeFilter] : undefined,
            source_conversation: sourceConversation.trim() || undefined,
            cluster_id: effectiveCluster,
          }),
        })) as { items: SemanticRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        offsetRef.current = nextOffset;
        setHasSearchQuery(Boolean(trimmedQuery));
        setLoaded(true);
        loadedRef.current = true;
      } catch (e) {
        logCaughtError("routes/_sidebar/semantic-memory", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [query, typeFilter, statusFilter, sourceConversation, clusterFilter, sortBy],
  );

  useEffect(() => {
    fetchListRef.current = fetchList;
  }, [fetchList]);

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  const filterByCluster = (next: number | null) => {
    setClusterFilter(next);
    void fetchList(0, next);
  };

  const onTogglePinned = async (row: SemanticRow, nextPinned: boolean) => {
    if (row.status !== "active") return;
    setToggling((prev) => ({ ...prev, [row.id]: true }));
    setError("");
    try {
      await updateSemanticMemoryPinned({ id: row.id, pinned: nextPinned });
      setItems((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, pinned: nextPinned } : item)),
      );
    } catch (e) {
      logCaughtError("routes/_sidebar/semantic-memory", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setToggling((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
  };

  const onCalibrateClusters = () => {
    setPipelineError("");
    void startStep(CLUSTER_CALIBRATE_STEP);
  };

  const displayError = error || pipelineError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold mb-1">{"📝 语义记忆"}</h2>
          <p className="text-sm text-muted-foreground">
            {"浏览 PG semantic_memory 表，支持 FTS 搜索、聚类族过滤与全量聚类校准。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            title={
              "对语义记忆 embedding 做 DBSCAN 全量校准（可能耗时；超 max_calibrate_n 会 skip）"
            }
            isDisabled={pipelineBusy}
            onClick={onCalibrateClusters}
          >
            {calibrating ? <Spinner /> : null}
            {calibrating ? "聚类中…" : "全量聚类"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setConsolidationOpen(true)}
          >
            {"记忆巩固"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPassiveSheetOpen(true)}
          >
            {"🔎 被动召回调试"}
          </Button>
        </div>
      </div>

      <MemoryConsolidationDialog open={consolidationOpen} onOpenChange={setConsolidationOpen} />

      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <Card className="bg-muted py-0">
          <CardContent className="gap-3 py-4 px-4">
            <FormFieldset bordered={false} className="gap-3">
              <FormField label={"搜索词（可选，FTS）"} className="text-xs">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  className="h-8"
                  placeholder={"关键词…"}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <FormFieldLabel className="text-xs py-0">{"类型"}</FormFieldLabel>
                  <Select
                    selectedKey={typeFilter || ALL_VALUE}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      const v = String(key);
                      setTypeFilter(v === ALL_VALUE ? "" : v);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id={ALL_VALUE}>{"全部"}</SelectItem>
                      {SEMANTIC_TYPES.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">{"状态"}</FormFieldLabel>
                  <Select
                    selectedKey={statusFilter}
                    onSelectionChange={(key) => {
                      if (key != null) setStatusFilter(String(key));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="active">active</SelectItem>
                      <SelectItem id="deprecated">deprecated</SelectItem>
                      <SelectItem id="all">{"全部"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">{"聚类族"}</FormFieldLabel>
                  <Select
                    selectedKey={clusterFilterKey(clusterFilter)}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      setClusterFilter(parseClusterFilterKey(String(key)));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id={ALL_VALUE}>{"全部"}</SelectItem>
                      <SelectItem id={UNGROUPED_VALUE}>
                        {ungroupedCount != null ? `未分组（${ungroupedCount}）` : "未分组"}
                      </SelectItem>
                      {clusterStats
                        .filter((s) => s.cluster_id != null)
                        .map((s) => (
                          <SelectItem key={String(s.cluster_id)} id={String(s.cluster_id)}>
                            {`族 ${s.cluster_id}（${s.count}）`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">{"来源对话（可选）"}</FormFieldLabel>
                  <Input
                    value={sourceConversation}
                    onChange={(e) => setSourceConversation(e.target.value)}
                    type="text"
                    className="h-8 font-mono w-full"
                    placeholder="conversation id"
                  />
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">{"排序"}</FormFieldLabel>
                  <Select
                    selectedKey={sortBy}
                    onSelectionChange={(key) => {
                      if (key != null) setSortBy(String(key) as BrowseSortBy);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="updated_at">{"更新时间"}</SelectItem>
                      <SelectItem id="created_at">{"创建时间"}</SelectItem>
                      <SelectItem id="reference_count">{"引用次数"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormFieldset>
            <Button type="submit" size="sm" isDisabled={loading}>
              {loading ? <Spinner /> : null}
              {"查询"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {displayError ? (
        <StatusAlert variant="error" className="mb-4">
          {displayError}
        </StatusAlert>
      ) : null}

      {loaded ? (
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <StatusAlert variant="info">{"无匹配记录。"}</StatusAlert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>id</TableHead>
                    <TableHead>{"类型"}</TableHead>
                    <TableHead>{"聚类族"}</TableHead>
                    <TableHead>{"状态"}</TableHead>
                    <TableHead>{"置顶"}</TableHead>
                    <TableHead>{"创建时间"}</TableHead>
                    <TableHead>{"更新时间"}</TableHead>
                    <TableHead>{"引用"}</TableHead>
                    <TableHead>{"内容"}</TableHead>
                    <TableHead>conversations</TableHead>
                    {hasSearchQuery ? <TableHead>{"排名"}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {row.id}
                      </TableCell>
                      <TableCell className="text-xs">{row.type}</TableCell>
                      <TableCell className="text-xs">
                        <button
                          type="button"
                          className="inline-flex"
                          title={"按此聚类族筛选"}
                          onClick={() => filterByCluster(row.cluster_id ?? null)}
                        >
                          <Badge variant="ghost" className="text-xs">
                            {formatClusterLabel(row.cluster_id)}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                      <TableCell className="text-xs">
                        {row.status === "active" ? (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`pin-${row.id}`} className="sr-only">
                              {"置顶到常驻记忆"}
                            </Label>
                            <Switch
                              id={`pin-${row.id}`}
                              isSelected={row.pinned}
                              isDisabled={Boolean(toggling[row.id])}
                              onChange={(checked) => void onTogglePinned(row, checked)}
                            />
                          </div>
                        ) : row.pinned ? (
                          <Badge variant="ghost" className="text-xs">
                            pinned
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.updated_at)}
                      </TableCell>
                      <TableCell className="text-xs">{row.reference_count.toFixed(2)}</TableCell>
                      <TableCell className="text-sm max-w-md whitespace-pre-wrap">
                        {row.content}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-32 truncate">
                        {row.source_conversations?.length
                          ? row.source_conversations.join(", ")
                          : "-"}
                      </TableCell>
                      {hasSearchQuery ? (
                        <TableCell className="text-xs whitespace-nowrap">
                          {row.rank != null ? row.rank.toFixed(4) : "-"}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <MemoryListPagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            loading={loading}
            onPageChange={onPageChange}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{"点击「查询」加载列表。"}</p>
      )}

      <Sheet
        isOpen={passiveOpen}
        onOpenChange={setPassiveSheetOpen}
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="border-b shrink-0 px-4 py-3">
          <SheetTitle>{"🔎 被动召回调试"}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {passiveOpen ? <PassiveRecallDebugPanel /> : null}
        </div>
      </Sheet>
    </div>
  );
}

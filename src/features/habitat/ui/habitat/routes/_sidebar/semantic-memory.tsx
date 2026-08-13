import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { SemanticMemoryRow } from "@freeanima/host/core/db/schema/rows";
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
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  listSemanticMemories,
  updateSemanticMemoryPinned,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

const PAGE_SIZE = 20;
const ALL_VALUE = "__all__";

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

type SemanticRow = SemanticMemoryRow & { rank?: number };

export const Route = createFileRoute("/_sidebar/semantic-memory")({
  component: SemanticMemoryPage,
});

function SemanticMemoryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceConversation, setSourceConversation] = useState("");
  const [sortBy, setSortBy] = useState<BrowseSortBy>("updated_at");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<SemanticRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasSearchQuery, setHasSearchQuery] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      const trimmedQuery = query.trim();
      const effectiveSortBy = trimmedQuery ? "rank" : sortBy;
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
          }),
        })) as { items: SemanticRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setHasSearchQuery(Boolean(trimmedQuery));
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/semantic-memory", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [query, typeFilter, statusFilter, sourceConversation, sortBy],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
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

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{"📝 语义记忆"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"浏览 PG semantic_memory 表，支持 FTS 搜索与过滤。"}
      </p>

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
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
    </div>
  );
}

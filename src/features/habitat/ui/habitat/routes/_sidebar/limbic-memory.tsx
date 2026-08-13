import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { LimbicMemoryRow } from "@freeanima/shared/db-shapes";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
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
import { listLimbicMemories } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";

const PAGE_SIZE = 20;
const ALL_VALUE = "__all__";

const LIMBIC_KINDS = ["conversation_mood", "turning_point", "spike"] as const;

type LimbicRow = LimbicMemoryRow;

export const Route = createFileRoute("/_sidebar/limbic-memory")({
  component: LimbicMemoryPage,
});

function LimbicMemoryPage() {
  const [query, setQuery] = useState("");
  const [conversationId, setSessionId] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const { setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LimbicRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listLimbicMemories(
          omitUndefined({
            query: query.trim() || undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
            conversation_id: conversationId.trim() || undefined,
            kind: kindFilter || undefined,
          }),
        )) as { items: LimbicRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/limbic-memory", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [query, conversationId, kindFilter, setOffset],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{"💗 情感记忆"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"浏览 limbic_memory（边缘系统 / 情感强度记录）。"}
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
              <FormField label={"搜索词（可选，内容 ILIKE）"} className="text-xs">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  className="h-8"
                  placeholder={"关键词…"}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <FormFieldLabel className="text-xs py-0">conversation_id</FormFieldLabel>
                  <Input
                    value={conversationId}
                    onChange={(e) => setSessionId(e.target.value)}
                    type="text"
                    className="h-8 font-mono w-full"
                    placeholder={"可选"}
                  />
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">kind</FormFieldLabel>
                  <Select
                    selectedKey={kindFilter || ALL_VALUE}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      const v = String(key);
                      setKindFilter(v === ALL_VALUE ? "" : v);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id={ALL_VALUE}>{"全部"}</SelectItem>
                      {LIMBIC_KINDS.map((k) => (
                        <SelectItem key={k} id={k}>
                          {k}
                        </SelectItem>
                      ))}
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
                    <TableHead>{"时间"}</TableHead>
                    <TableHead>kind</TableHead>
                    <TableHead>session</TableHead>
                    <TableHead>{"强度"}</TableHead>
                    <TableHead>{"内容"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDisplayDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">{row.kind}</TableCell>
                      <TableCell className="font-mono text-xs max-w-32 truncate">
                        {row.conversation_id}
                      </TableCell>
                      <TableCell className="text-xs">{row.intensity.toFixed(2)}</TableCell>
                      <TableCell className="text-sm max-w-md whitespace-pre-wrap">
                        {row.content}
                      </TableCell>
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

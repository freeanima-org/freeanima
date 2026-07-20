import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { SemanticMemoryRow } from "@freeanima/core/db/schema/rows";
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
} from "@freeanima/frontend/ui-kit";
import {
  FormField,
  FormFieldLabel,
  FormFieldset,
} from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
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
        setError(
          m.habitat_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
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
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
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
      <h2 className="text-lg font-bold mb-1">{m.habitat_nav_semantic()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_semantic_desc()}</p>

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
              <FormField label={m.habitat_semantic_search_fts()} className="text-xs">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  className="h-8"
                  placeholder={m.habitat_common_keyword_placeholder()}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_common_type_label()}
                  </FormFieldLabel>
                  <Select
                    value={typeFilter || ALL_VALUE}
                    onValueChange={(v) => setTypeFilter(v === ALL_VALUE ? "" : v)}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>{m.habitat_common_all()}</SelectItem>
                      {SEMANTIC_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_common_status_label()}
                  </FormFieldLabel>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="deprecated">deprecated</SelectItem>
                      <SelectItem value="all">{m.habitat_common_all()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_semantic_source_conversation()}
                  </FormFieldLabel>
                  <Input
                    value={sourceConversation}
                    onChange={(e) => setSourceConversation(e.target.value)}
                    type="text"
                    className="h-8 font-mono w-full"
                    placeholder="conversation id"
                  />
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_semantic_sort()}
                  </FormFieldLabel>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as BrowseSortBy)}>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_at">
                        {m.habitat_semantic_sort_updated()}
                      </SelectItem>
                      <SelectItem value="created_at">
                        {m.habitat_semantic_sort_created()}
                      </SelectItem>
                      <SelectItem value="reference_count">
                        {m.habitat_semantic_sort_reference_count()}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormFieldset>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Spinner /> : null}
              {m.habitat_common_query()}
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
            <StatusAlert variant="info">{m.habitat_common_no_results()}</StatusAlert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>id</TableHead>
                    <TableHead>{m.habitat_common_type_label()}</TableHead>
                    <TableHead>{m.habitat_common_status_label()}</TableHead>
                    <TableHead>{m.habitat_semantic_pinned()}</TableHead>
                    <TableHead>{m.habitat_semantic_created()}</TableHead>
                    <TableHead>{m.habitat_semantic_updated()}</TableHead>
                    <TableHead>{m.habitat_semantic_reference_count()}</TableHead>
                    <TableHead>{m.habitat_limbic_content()}</TableHead>
                    <TableHead>conversations</TableHead>
                    {hasSearchQuery ? <TableHead>{m.habitat_semantic_rank()}</TableHead> : null}
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
                              {m.habitat_semantic_pin_toggle()}
                            </Label>
                            <Switch
                              id={`pin-${row.id}`}
                              checked={row.pinned}
                              disabled={Boolean(toggling[row.id])}
                              onCheckedChange={(checked) => void onTogglePinned(row, checked)}
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
                      <TableCell className="text-xs">
                        {Number(row.reference_count).toFixed(2)}
                      </TableCell>
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
                          {row.rank != null ? Number(row.rank).toFixed(4) : "-"}
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
        <p className="text-sm text-muted-foreground">{m.habitat_common_click_query_hint()}</p>
      )}
    </div>
  );
}

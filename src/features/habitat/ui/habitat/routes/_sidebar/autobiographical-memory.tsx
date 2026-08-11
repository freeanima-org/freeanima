import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { AutobiographicalMemoryRow } from "@freeanima/host/core/db/schema/rows";
import {
  Badge,
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
} from "@freeanima/ui-kit";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { listAutobiographicalMemories } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";

const PAGE_SIZE = 20;
const ALL_VALUE = "__all__";

const SIGNIFICANCE_OPTIONS = ["normal", "milestone", "turning_point"] as const;

type AutobiographicalRow = AutobiographicalMemoryRow;

export const Route = createFileRoute("/_sidebar/autobiographical-memory")({
  component: AutobiographicalMemoryPage,
});

function AutobiographicalMemoryPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [significanceFilter, setSignificanceFilter] = useState("");
  const [sourceSession, setSourceSession] = useState("");
  const { setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AutobiographicalRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listAutobiographicalMemories(
          omitUndefined({
            query: query.trim() || undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
            status: statusFilter || undefined,
            significance: significanceFilter || undefined,
            source_conversation: sourceSession.trim() || undefined,
          }),
        )) as { items: AutobiographicalRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/autobiographical-memory", e);
        setError(
          m.habitat_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [query, statusFilter, significanceFilter, sourceSession, setOffset],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.habitat_nav_autobio()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_autobio_desc()}</p>

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
              <FormField label={m.habitat_autobio_search()} className="text-xs">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  className="h-8"
                  placeholder={m.habitat_common_keyword_placeholder()}
                />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_common_status_label()}
                  </FormFieldLabel>
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
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">significance</FormFieldLabel>
                  <Select
                    selectedKey={significanceFilter || ALL_VALUE}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      const v = String(key);
                      setSignificanceFilter(v === ALL_VALUE ? "" : v);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id={ALL_VALUE}>{m.habitat_common_all()}</SelectItem>
                      {SIGNIFICANCE_OPTIONS.map((s) => (
                        <SelectItem key={s} id={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FormFieldLabel className="text-xs py-0">
                    {m.habitat_autobio_source_conversation()}
                  </FormFieldLabel>
                  <Input
                    value={sourceSession}
                    onChange={(e) => setSourceSession(e.target.value)}
                    type="text"
                    className="h-8 font-mono w-full"
                    placeholder="conversation id"
                  />
                </div>
              </div>
            </FormFieldset>
            <Button type="submit" size="sm" isDisabled={loading}>
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
            <div className="space-y-2">
              {items.map((row) => (
                <Card key={row.id} className="bg-muted py-0">
                  <CardContent className="py-3 px-4 gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-sm">{row.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {row.significance}
                      </Badge>
                      <Badge variant="ghost" className="text-xs">
                        {row.status}
                      </Badge>
                      <span className="font-mono text-muted-foreground">{row.id}</span>
                      <span className="text-muted-foreground">
                        {formatDisplayDateTime(row.updated_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{row.content}</p>
                    {row.source_conversations?.length ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        conversations: {row.source_conversations.join(", ")}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
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

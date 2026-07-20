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
} from "@freeanima/frontend/ui-kit";
import { FormField } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { listAutoLlmRuns } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
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
  "subagent",
] as const;

const ALL_VALUE = "__all__";

type AutoLlmRunRow = {
  id: string;
  run_name: string;
  run_kind: string;
  input_summary: string;
  output: string;
  status: string;
  duration_ms: number;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string;
};

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec} s`;
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
        setError(
          m.habitat_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [runKind, statusFilter, setOffset],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList(offsetForPage(page));
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.habitat_nav_auto_llm_runs()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_auto_llm_runs_desc()}</p>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <FormField label={m.habitat_auto_llm_runs_run_kind()} className="w-full max-w-xs text-xs">
          <Select
            value={runKind || ALL_VALUE}
            onValueChange={(v) => setRunKind(v === ALL_VALUE ? "" : v)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{m.habitat_common_all()}</SelectItem>
              {RUN_KIND_OPTIONS.filter(Boolean).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={m.habitat_common_status()} className="w-full max-w-xs text-xs">
          <Select
            value={statusFilter || ALL_VALUE}
            onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : v)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{m.habitat_common_all()}</SelectItem>
              <SelectItem value="ok">{m.habitat_common_success()}</SelectItem>
              <SelectItem value="error">{m.habitat_common_failed()}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <Button type="button" size="sm" onClick={runSearch} disabled={loading}>
          {loading ? m.habitat_common_loading() : m.habitat_common_refresh()}
        </Button>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {loaded && items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">{m.habitat_auto_llm_runs_empty()}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.habitat_common_time()}</TableHead>
                <TableHead>{m.habitat_auto_llm_runs_run_name()}</TableHead>
                <TableHead>{m.habitat_auto_llm_runs_run_kind()}</TableHead>
                <TableHead>{m.habitat_common_status()}</TableHead>
                <TableHead>{m.habitat_auto_llm_runs_duration()}</TableHead>
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
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        {expandedId === row.id
                          ? m.habitat_common_collapse()
                          : m.habitat_common_details()}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === row.id ? (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted">
                        <p className="text-xs font-mono text-muted-foreground mb-2 break-all">
                          {row.id}
                        </p>
                        {row.input_summary ? (
                          <div className="mb-2">
                            <p className="text-xs font-semibold mb-1">
                              {m.habitat_auto_llm_runs_input()}
                            </p>
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
                            <p className="text-xs font-semibold mb-1">
                              {m.habitat_auto_llm_runs_output()}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                              {row.output}
                            </pre>
                          </div>
                        ) : null}
                        {row.metadata && Object.keys(row.metadata).length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-1">
                              {m.habitat_auto_llm_runs_metadata()}
                            </p>
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

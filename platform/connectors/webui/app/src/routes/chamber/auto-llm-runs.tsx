import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/chamber/MemoryListPagination.tsx";
import { listAutoLlmRuns } from "@/lib/api.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";

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

function statusBadgeClass(status: string): string {
  return status === "ok" ? "badge-success" : "badge-error";
}

export const Route = createFileRoute("/chamber/auto-llm-runs")({
  component: AutoLlmRunsPage,
});

function AutoLlmRunsPage() {
  const [runKind, setRunKind] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AutoLlmRunRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listAutoLlmRuns({
          run_kind: runKind || undefined,
          status: statusFilter === "ok" || statusFilter === "error" ? statusFilter : undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
        })) as { items: AutoLlmRunRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        setError(
          m.webui_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [runKind, statusFilter],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_auto_llm_runs()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_auto_llm_runs_desc()}</p>

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <label className="form-control w-full max-w-xs">
          <span className="label-text text-xs">{m.webui_chamber_auto_llm_runs_run_kind()}</span>
          <select
            className="select select-bordered select-sm"
            value={runKind}
            onChange={(e) => setRunKind(e.target.value)}
          >
            <option value="">{m.webui_common_all()}</option>
            {RUN_KIND_OPTIONS.filter(Boolean).map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control w-full max-w-xs">
          <span className="label-text text-xs">{m.webui_common_status()}</span>
          <select
            className="select select-bordered select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{m.webui_common_all()}</option>
            <option value="ok">{m.webui_common_success()}</option>
            <option value="error">{m.webui_common_failed()}</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={runSearch}
          disabled={loading}
        >
          {loading ? m.webui_common_loading() : m.webui_common_refresh()}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loaded && !items.length && !loading ? (
        <p className="text-sm text-base-content/60">{m.webui_chamber_auto_llm_runs_empty()}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>{m.webui_common_time()}</th>
                <th>{m.webui_chamber_auto_llm_runs_run_name()}</th>
                <th>{m.webui_chamber_auto_llm_runs_run_kind()}</th>
                <th>{m.webui_common_status()}</th>
                <th>{m.webui_chamber_auto_llm_runs_duration()}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <Fragment key={row.id}>
                  <tr className={row.status === "ok" ? "" : "bg-error/10"}>
                    <td className="whitespace-nowrap">{formatDisplayDateTime(row.finished_at)}</td>
                    <td className="max-w-[12rem] truncate" title={row.run_name}>
                      {row.run_name}
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm font-mono">{row.run_kind}</span>
                    </td>
                    <td>
                      <span className={`badge badge-sm ${statusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{formatDurationMs(row.duration_ms)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        {expandedId === row.id
                          ? m.webui_common_collapse()
                          : m.webui_common_details()}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr>
                      <td colSpan={6} className="bg-base-200">
                        <p className="text-xs font-mono text-base-content/50 mb-2 break-all">
                          {row.id}
                        </p>
                        {row.input_summary ? (
                          <div className="mb-2">
                            <p className="text-xs font-semibold mb-1">
                              {m.webui_chamber_auto_llm_runs_input()}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                              {row.input_summary}
                            </pre>
                          </div>
                        ) : null}
                        {row.status === "error" && row.error ? (
                          <pre className="text-xs text-error whitespace-pre-wrap break-all mb-2">
                            {row.error}
                          </pre>
                        ) : null}
                        {row.output ? (
                          <div className="mb-2">
                            <p className="text-xs font-semibold mb-1">
                              {m.webui_chamber_auto_llm_runs_output()}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto">
                              {row.output}
                            </pre>
                          </div>
                        ) : null}
                        {row.metadata && Object.keys(row.metadata).length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-1">
                              {m.webui_chamber_auto_llm_runs_metadata()}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
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

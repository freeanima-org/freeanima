import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MemoryListPagination } from "@/components/admin/MemoryListPagination.tsx";
import { m } from "@/lib/i18n.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { listTasks } from "@/lib/api.ts";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = () =>
  [
    { value: "active", label: m.admin_common_active_filter() },
    { value: "all", label: m.admin_common_all() },
    { value: "pending", label: "pending" },
    { value: "in_progress", label: "in_progress" },
    { value: "completed", label: "completed" },
    { value: "cancelled", label: "cancelled" },
  ] as const;

const PRIORITY_OPTIONS = ["high", "medium", "low", "none"] as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source_conversation_id: string | null;
};

function resolveStatusFilter(value: string): "all" | string | string[] | undefined {
  if (value === "active") return undefined;
  if (value === "all") return "all";
  return value;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "badge-success";
    case "cancelled":
      return "badge-ghost";
    case "in_progress":
      return "badge-info";
    default:
      return "badge-warning";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "high":
      return "badge-error";
    case "medium":
      return "badge-warning";
    case "low":
      return "badge-info";
    default:
      return "badge-ghost";
  }
}

export const Route = createFileRoute("/_sidebar/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const data = (await listTasks({
          query: query.trim() || undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
          status: resolveStatusFilter(statusFilter),
          priority: priorityFilter || undefined,
        })) as { items: TaskRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        setError(
          m.admin_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [query, statusFilter, priorityFilter],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    const nextOffset = (page - 1) * PAGE_SIZE;
    void fetchList(nextOffset);
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_tasks()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.admin_tasks_desc()}</p>

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="card-body gap-3">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-xs">{m.admin_tasks_search_label()}</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm"
              placeholder={m.admin_common_keyword_placeholder()}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">{m.admin_common_status_label()}</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text text-xs">{m.admin_common_priority_label()}</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">{m.admin_common_all()}</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            {m.admin_common_query()}
          </button>
        </div>
      </form>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loaded ? (
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-dots loading-sm" />
            </div>
          ) : items.length === 0 ? (
            <div className="alert alert-info text-sm">{m.admin_common_no_results()}</div>
          ) : (
            <div className="space-y-2">
              {items.map((row) => (
                <div key={row.id} className="card bg-base-200">
                  <div className="card-body py-3 px-4 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{row.title}</span>
                      <span className={`badge badge-xs ${statusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                      <span
                        className={`badge badge-outline badge-xs ${priorityBadgeClass(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    </div>
                    {row.description ? (
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">
                        {row.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/60">
                      <span>
                        id: <span className="font-mono">{row.id}</span>
                      </span>
                      <span>due: {formatDisplayDateTime(row.due_at)}</span>
                      <span>created: {formatDisplayDateTime(row.created_at)}</span>
                      <span>updated: {formatDisplayDateTime(row.updated_at)}</span>
                      {row.completed_at ? (
                        <span>completed: {formatDisplayDateTime(row.completed_at)}</span>
                      ) : null}
                    </div>
                    {row.source_conversation_id ? (
                      <p className="text-xs text-base-content/50">
                        session:{" "}
                        <Link
                          to="/conversations/$conversationId"
                          params={{ conversationId: row.source_conversation_id }}
                          className="link link-hover font-mono"
                        >
                          {row.source_conversation_id}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
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
        <p className="text-sm text-base-content/50">{m.admin_common_click_query_hint()}</p>
      )}
    </div>
  );
}

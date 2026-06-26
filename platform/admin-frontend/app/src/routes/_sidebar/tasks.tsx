import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { FormField, FormFieldLabel, FormFieldset } from "@freeanima/satellite-sdk/form";
import { MemoryListPagination } from "@admin/components/admin/MemoryListPagination.tsx";
import { m } from "@admin/lib/i18n.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { listEntityTaskItems, listEntityTaskLists } from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = () =>
  [
    { value: "all", label: m.admin_common_all() },
    { value: "pending", label: "pending" },
    { value: "completed", label: "completed" },
  ] as const;

const PRIORITY_OPTIONS = ["high", "medium", "low", "none"] as const;

type TaskItemRow = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  status: string;
  priority: string;
  due_at: string | null;
  list_id: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskListRow = {
  id: number;
  name: string;
};

function statusBadgeClass(status: string): string {
  return status === "completed" ? "badge-success" : "badge-warning";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lists, setLists] = useState<TaskListRow[]>([]);
  const [allItems, setAllItems] = useState<TaskItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const listNameById = (id: number) => lists.find((l) => l.id === id)?.name ?? `#${id}`;

  const filteredItems = allItems.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${row.title}\n${row.content}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (priorityFilter && row.priority !== priorityFilter) return false;
    if (listFilter && String(row.list_id) !== listFilter) return false;
    return true;
  });

  const total = filteredItems.length;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const items = filteredItems.slice(offset, offset + PAGE_SIZE);

  const fetchList = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const [listsData, itemsData] = await Promise.all([
          listEntityTaskLists() as Promise<{ items: TaskListRow[] }>,
          listEntityTaskItems({
            status: statusFilter as "pending" | "completed" | "all",
          }) as Promise<{ items: TaskItemRow[] }>,
        ]);
        setLists(listsData.items ?? []);
        setAllItems(itemsData.items ?? []);
        setOffset(nextOffset);
        setLoaded(true);
      } catch (e) {
        logCaughtError("routes/_sidebar/tasks", e);
        setError(
          m.admin_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  const runSearch = () => {
    void fetchList(0);
  };

  const onPageChange = (page: number) => {
    setOffset((page - 1) * PAGE_SIZE);
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
          <FormFieldset bordered={false} className="gap-3">
            <FormField label={m.admin_tasks_search_label()} className="text-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                className="input input-bordered input-sm"
                placeholder={m.admin_common_keyword_placeholder()}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_common_status_label()}
                </FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
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
              <div>
                <FormFieldLabel className="text-xs py-0">
                  {m.admin_common_priority_label()}
                </FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
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
              <div>
                <FormFieldLabel className="text-xs py-0">清单</FormFieldLabel>
                <select
                  className="select select-bordered select-sm w-full"
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                >
                  <option value="">{m.admin_common_all()}</option>
                  {lists.map((l) => (
                    <option key={l.id} value={String(l.id)}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormFieldset>
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
                      <span className="badge badge-ghost badge-xs">
                        {listNameById(row.list_id)}
                      </span>
                    </div>
                    {row.content ? (
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">
                        {row.content}
                      </p>
                    ) : null}
                    {row.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.tags.map((tag) => (
                          <span key={tag} className="badge badge-outline badge-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
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

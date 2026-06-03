import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SessionMessagePanel } from "@/components/chamber/SessionMessagePanel";
import { useChamberSessionsStore } from "@/stores/chamber-sessions";

export const Route = createFileRoute("/chamber/sessions")({
  component: ChamberSessionsPage,
});

function formatCreated(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso.slice(0, 16);
  }
}

function ChamberSessionsPage() {
  const store = useChamberSessionsStore();

  useEffect(() => {
    void useChamberSessionsStore.getState().fetchSessions();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">会话列表</h2>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={store.loadingSessions}
          onClick={() => void store.fetchSessions()}
        >
          刷新
        </button>
      </div>

      {store.loadingSessions ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : (
        <div className="card bg-base-200">
          <div className="card-body p-0">
            {store.sortedSessions().length === 0 ? (
              <div className="text-sm text-base-content/50 p-4">无会话</div>
            ) : (
              <div className="divide-y divide-base-300/50">
                {store.sortedSessions().map((s) => (
                  <div
                    key={s.id}
                    className={store.selectedId === s.id ? "bg-base-300/30 transition-colors" : "transition-colors"}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-base-300/20 transition-colors"
                      onClick={() => store.toggleSession(s.id)}
                    >
                      <span className="shrink-0 text-base-content/50 w-4">
                        {store.selectedId === s.id ? "▼" : "▶"}
                      </span>
                      <span className="badge badge-ghost badge-xs shrink-0">{s.platform || "legacy"}</span>
                      <span className="flex-1 truncate text-sm">{s.title || "（无标题）"}</span>
                      <span className="font-mono text-[10px] text-base-content/40 shrink-0 hidden sm:inline">
                        {s.id}
                      </span>
                      {s.created ? (
                        <span className="text-[10px] text-base-content/40 shrink-0 hidden md:inline">
                          {formatCreated(s.created)}
                        </span>
                      ) : null}
                    </button>

                    {store.selectedId === s.id ? (
                      <div className="px-4 pb-4 border-t border-base-300/30 bg-base-100/40">
                        <div className="font-mono text-[10px] text-base-content/40 py-2 break-all sm:hidden">
                          {s.id}
                        </div>
                        <SessionMessagePanel
                          items={store.display}
                          total={store.total}
                          currentPage={store.currentPage()}
                          pageCount={store.pageCount()}
                          pageSize={store.limit}
                          pageOffset={store.offset}
                          loading={store.loadingMessages}
                          onPageChange={(p) => void store.goToPage(p)}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {store.error ? <div className="alert alert-error text-sm mt-4">{store.error}</div> : null}
    </div>
  );
}

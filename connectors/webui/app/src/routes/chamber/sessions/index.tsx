import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useChamberSessionsStore } from "@/stores/chamber-sessions.ts";

export const Route = createFileRoute("/chamber/sessions/")({
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
  const sessions = store.paginatedSessions();
  const pageCount = store.sessionsPageCount();
  const currentPage = store.currentSessionsPage();
  const totalSessions = store.sortedSessions().length;

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
            {totalSessions === 0 ? (
              <div className="text-sm text-base-content/50 p-4">无会话</div>
            ) : (
              <>
                <div className="divide-y divide-base-300/50">
                  {sessions.map((s) => (
                    <Link
                      key={s.id}
                      to="/chamber/sessions/$sessionId"
                      params={{ sessionId: s.id }}
                      className="block w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-base-300/20 transition-colors"
                    >
                      <span className="badge badge-ghost badge-xs shrink-0">
                        {s.platform || "legacy"}
                      </span>
                      <span className="flex-1 truncate text-sm">{s.title || "（无标题）"}</span>
                      <span className="font-mono text-[10px] text-base-content/40 shrink-0 hidden sm:inline">
                        {s.id}
                      </span>
                      {s.created ? (
                        <span className="text-[10px] text-base-content/40 shrink-0 hidden md:inline">
                          {formatCreated(s.created)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>

                {pageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-base-300/50 text-xs">
                    <span className="text-base-content/60">
                      共 {totalSessions} 条 · 第 {currentPage} / {pageCount} 页
                    </span>
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-xs join-item"
                        disabled={currentPage <= 1}
                        onClick={() => store.goToSessionsPage(currentPage - 1)}
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs join-item"
                        disabled={currentPage >= pageCount}
                        onClick={() => store.goToSessionsPage(currentPage + 1)}
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {store.error ? <div className="alert alert-error text-sm mt-4">{store.error}</div> : null}
    </div>
  );
}

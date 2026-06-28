import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { useAdminConversationsStore } from "@admin/stores/admin-conversations.ts";

export const Route = createFileRoute("/_sidebar/conversations/")({
  component: AdminConversationsPage,
});

function AdminConversationsPage() {
  const store = useAdminConversationsStore();
  const conversations = store.conversations;
  const pageCount = store.conversationsPageCount();
  const currentPage = store.currentConversationsPage();
  const totalConversations = store.conversationsTotal;

  useEffect(() => {
    void useAdminConversationsStore.getState().fetchConversations();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{m.admin_nav_conversations()}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={store.loadingConversations}
          onClick={() => void store.fetchConversations({ force: true })}
        >
          {m.admin_common_refresh()}
        </button>
      </div>

      {store.loadingConversations ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : (
        <div className="card bg-base-200">
          <div className="card-body p-0">
            {totalConversations === 0 ? (
              <div className="text-sm text-base-content/50 p-4">
                {m.admin_conversations_empty()}
              </div>
            ) : (
              <>
                <div className="divide-y divide-base-300/50">
                  {conversations.map((s) => (
                    <Link
                      key={s.id}
                      to="/conversations/$conversationId"
                      params={{ conversationId: s.id }}
                      className="block w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-base-300/20 transition-colors"
                    >
                      <span className="badge badge-ghost badge-xs shrink-0">
                        {s.platform || "legacy"}
                      </span>
                      <span className="flex-1 truncate text-sm">
                        {s.title || m.admin_common_no_title()}
                      </span>
                      <span className="font-mono text-[10px] text-base-content/40 shrink-0 hidden sm:inline">
                        {s.id}
                      </span>
                      {s.created_at ? (
                        <span className="text-[10px] text-base-content/40 shrink-0 hidden md:inline">
                          {formatDisplayDateTime(s.created_at)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>

                {pageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-base-300/50 text-xs">
                    <span className="text-base-content/60">
                      {m.admin_common_pagination({
                        total: String(totalConversations),
                        current: String(currentPage),
                        pages: String(pageCount),
                      })}
                    </span>
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-xs join-item"
                        disabled={currentPage <= 1}
                        onClick={() => void store.goToConversationsPage(currentPage - 1)}
                      >
                        {m.admin_common_previous_page()}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs join-item"
                        disabled={currentPage >= pageCount}
                        onClick={() => void store.goToConversationsPage(currentPage + 1)}
                      >
                        {m.admin_common_next_page()}
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

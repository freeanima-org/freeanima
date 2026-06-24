import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { StoredMessagePanel } from "@/components/chamber/ConversationMessagePanel.tsx";
import { AcpProgressDock } from "@/components/AcpProgressDock.tsx";
import { useAcpProgressDock } from "@/hooks/useAcpProgressDock.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";
import { useChamberConversationsStore } from "@/stores/chamber-conversations.ts";

export const Route = createFileRoute("/chamber/conversations/$conversationId")({
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const store = useChamberConversationsStore();
  const conversation = store.findConversation(conversationId);

  const acpDock = useAcpProgressDock(conversationId, {
    onDecision: async (sid) => {
      await useChamberConversationsStore.getState().selectConversation(sid, store.currentPage());
    },
  });

  useEffect(() => {
    void useChamberConversationsStore.getState().ensureConversationHeadline(conversationId);
  }, [conversationId]);

  useEffect(() => {
    void useChamberConversationsStore.getState().selectConversation(conversationId, 1);
  }, [conversationId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/chamber/conversations" className="btn btn-ghost btn-xs">
          {m.webui_chamber_conversations_back_list()}
        </Link>
        <h2 className="text-lg font-bold flex-1 truncate">
          {conversation?.title || m.webui_common_no_title()}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-base-content/60">
        <span className="badge badge-ghost badge-xs">{conversation?.platform || "legacy"}</span>
        {conversation?.created ? <span>{formatDisplayDateTime(conversation.created)}</span> : null}
        <span className="font-mono break-all">{conversationId}</span>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          {acpDock ? (
            <div className="mb-3">
              <AcpProgressDock dock={acpDock} />
            </div>
          ) : null}
          <StoredMessagePanel
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
      </div>

      {store.error ? <div className="alert alert-error text-sm mt-4">{store.error}</div> : null}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { StoredMessagePanel } from "@freeanima/features/console/ui/console/components/console/ConversationMessagePanel.tsx";
import { AcpProgressDock } from "@freeanima/features/console/ui/console/components/AcpProgressDock.tsx";
import { useAcpProgressDock } from "@freeanima/features/console/ui/console/hooks/useAcpProgressDock.ts";
import { formatDisplayDateTime } from "@freeanima/features/console/ui/console/lib/format-datetime.ts";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import { useConsoleConversationsStore } from "@freeanima/features/console/ui/console/stores/console-conversations.ts";

export const Route = createFileRoute("/_sidebar/conversations/$conversationId")({
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const store = useConsoleConversationsStore();
  const conversation = store.findConversation(conversationId);

  const acpDock = useAcpProgressDock(conversationId, {
    onDecision: async (sid) => {
      await useConsoleConversationsStore.getState().selectConversation(sid, store.currentPage());
    },
  });

  useEffect(() => {
    void useConsoleConversationsStore.getState().ensureConversationHeadline(conversationId);
  }, [conversationId]);

  useEffect(() => {
    void useConsoleConversationsStore.getState().selectConversation(conversationId, 1);
  }, [conversationId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/conversations">{m.console_conversations_back_list()}</Link>
        </Button>
        <h2 className="text-lg font-bold flex-1 truncate">
          {conversation?.title || m.console_common_no_title()}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-muted-foreground">
        <Badge variant="ghost" className="text-xs shrink-0">
          {conversation?.platform || "legacy"}
        </Badge>
        {conversation?.created_at ? (
          <span>{formatDisplayDateTime(conversation.created_at)}</span>
        ) : null}
        <span className="font-mono break-all">{conversationId}</span>
      </div>

      <Card className="bg-muted py-0">
        <CardContent>
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
        </CardContent>
      </Card>

      {store.error ? (
        <StatusAlert variant="error" className="mt-4">
          {store.error}
        </StatusAlert>
      ) : null}
    </div>
  );
}

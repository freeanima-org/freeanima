import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Badge, Card, CardContent, buttonVariants, cn } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { StoredMessagePanel } from "@freeanima/features/habitat/ui/habitat/components/habitat/ConversationMessagePanel.tsx";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { useHabitatConversationsStore } from "@freeanima/features/habitat/ui/habitat/stores/habitat-conversations.ts";

export const Route = createFileRoute("/_sidebar/conversations/$conversationId")({
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const store = useHabitatConversationsStore();
  const conversation = store.findConversation(conversationId);

  useEffect(() => {
    void useHabitatConversationsStore.getState().ensureConversationHeadline(conversationId);
  }, [conversationId]);

  useEffect(() => {
    void useHabitatConversationsStore.getState().selectConversation(conversationId, 1);
  }, [conversationId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          to="/conversations"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
        >
          {"← 返回列表"}
        </Link>
        <h2 className="text-lg font-bold flex-1 truncate">{conversation?.title || "（无标题）"}</h2>
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

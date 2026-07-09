import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Badge, Button, Card, CardContent, Spinner } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { formatDisplayDateTime } from "@freeanima/features/console/ui/console/lib/format-datetime.ts";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import { useConsoleConversationsStore } from "@freeanima/features/console/ui/console/stores/console-conversations.ts";

export const Route = createFileRoute("/_sidebar/conversations/")({
  component: ConsoleConversationsPage,
});

function ConsoleConversationsPage() {
  const store = useConsoleConversationsStore();
  const conversations = store.conversations;
  const pageCount = store.conversationsPageCount();
  const currentPage = store.currentConversationsPage();
  const totalConversations = store.conversationsTotal;

  useEffect(() => {
    void useConsoleConversationsStore.getState().fetchConversations();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{m.console_nav_conversations()}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={store.loadingConversations}
          onClick={() => void store.fetchConversations({ force: true })}
        >
          {m.console_common_refresh()}
        </Button>
      </div>

      {store.loadingConversations ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0">
            {totalConversations === 0 ? (
              <div className="text-sm text-muted-foreground p-4">
                {m.console_conversations_empty()}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/50">
                  {conversations.map((s) => (
                    <Link
                      key={s.id}
                      to="/conversations/$conversationId"
                      params={{ conversationId: s.id }}
                      className="block w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <Badge variant="ghost" className="text-xs shrink-0">
                        {s.platform || "legacy"}
                      </Badge>
                      <span className="flex-1 truncate text-sm">
                        {s.title || m.console_common_no_title()}
                      </span>
                      <span className="font-mono text-[10px] text-foreground/40 shrink-0 hidden sm:inline">
                        {s.id}
                      </span>
                      {s.created_at ? (
                        <span className="text-[10px] text-foreground/40 shrink-0 hidden md:inline">
                          {formatDisplayDateTime(s.created_at)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>

                {pageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border/50 text-xs">
                    <span className="text-muted-foreground">
                      {m.console_common_pagination({
                        total: String(totalConversations),
                        current: String(currentPage),
                        pages: String(pageCount),
                      })}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={currentPage <= 1}
                        onClick={() => void store.goToConversationsPage(currentPage - 1)}
                      >
                        {m.console_common_previous_page()}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={currentPage >= pageCount}
                        onClick={() => void store.goToConversationsPage(currentPage + 1)}
                      >
                        {m.console_common_next_page()}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {store.error ? (
        <StatusAlert variant="error" className="mt-4">
          {store.error}
        </StatusAlert>
      ) : null}
    </div>
  );
}

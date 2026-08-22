import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Spinner } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { useHabitatConversationsStore } from "@freeanima/features/habitat/ui/habitat/stores/habitat-conversations.ts";

export const Route = createFileRoute("/_sidebar/conversations/")({
  component: HabitatConversationsPage,
});

type ScenarioFilter = "all" | "digital_human" | "coding_agent" | "room_inner";
type PlatformFilter = "all" | "chat" | "coding" | "cron";

const SCENARIO_FILTERS: Array<{ id: ScenarioFilter; label: string }> = [
  { id: "all", label: "全部情景" },
  { id: "digital_human", label: "数字人类" },
  { id: "coding_agent", label: "Coding" },
  { id: "room_inner", label: "群聊内心" },
];

const PLATFORM_FILTERS: Array<{ id: PlatformFilter; label: string }> = [
  { id: "all", label: "全部通道" },
  { id: "chat", label: "chat" },
  { id: "coding", label: "coding" },
  { id: "cron", label: "cron" },
];

function scenarioLabel(scenario?: string): string {
  switch (scenario) {
    case "coding_agent":
      return "Coding";
    case "room_inner":
      return "群聊内心";
    case "digital_human":
      return "数字人类";
    default:
      return "数字人类";
  }
}

function HabitatConversationsPage() {
  const store = useHabitatConversationsStore();
  const conversations = store.conversations;
  const pageCount = store.conversationsPageCount();
  const currentPage = store.currentConversationsPage();
  const totalConversations = store.conversationsTotal;
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  useEffect(() => {
    void useHabitatConversationsStore.getState().fetchConversations({
      force: true,
      page: 1,
      ...(scenarioFilter !== "all" ? { scenario: scenarioFilter } : {}),
      ...(platformFilter !== "all" ? { platform: platformFilter } : {}),
    });
  }, [scenarioFilter, platformFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{"💬 对话"}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          isDisabled={store.loadingConversations}
          onClick={() =>
            void store.fetchConversations({
              force: true,
              ...(scenarioFilter !== "all" ? { scenario: scenarioFilter } : {}),
              ...(platformFilter !== "all" ? { platform: platformFilter } : {}),
            })
          }
        >
          {"刷新"}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {SCENARIO_FILTERS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={scenarioFilter === f.id ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => setScenarioFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {PLATFORM_FILTERS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={platformFilter === f.id ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => setPlatformFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {store.loadingConversations ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0">
            {totalConversations === 0 ? (
              <div className="text-muted-foreground p-4 text-sm">{"暂无对话"}</div>
            ) : (
              <>
                <div className="text-muted-foreground grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-3 border-b px-4 py-2 text-[11px] font-medium tracking-wide uppercase">
                  <span>通道</span>
                  <span>情景</span>
                  <span>标题</span>
                  <span className="hidden sm:inline">更新</span>
                </div>
                <div className="divide-y divide-border/50">
                  {conversations.map((s) => (
                    <Link
                      key={s.id}
                      to="/conversations/$conversationId"
                      params={{ conversationId: s.id }}
                      className="hover:bg-muted/20 grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors"
                    >
                      <Badge variant="ghost" className="shrink-0 text-xs">
                        {s.platform || "legacy"}
                      </Badge>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {scenarioLabel(s.scenario)}
                      </Badge>
                      <span className="min-w-0 truncate text-sm">{s.title || "（无标题）"}</span>
                      {s.updated_at ? (
                        <span className="text-foreground/40 hidden shrink-0 text-[10px] sm:inline">
                          {formatDisplayDateTime(s.updated_at)}
                        </span>
                      ) : (
                        <span />
                      )}
                    </Link>
                  ))}
                </div>

                {pageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2 border-t border/50 px-4 py-3 text-xs">
                    <span className="text-muted-foreground">
                      {`共 ${String(totalConversations)} 条 · 第 ${String(currentPage)} / ${String(pageCount)} 页`}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        isDisabled={currentPage <= 1}
                        onClick={() => void store.goToConversationsPage(currentPage - 1)}
                      >
                        {"上一页"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        isDisabled={currentPage >= pageCount}
                        onClick={() => void store.goToConversationsPage(currentPage + 1)}
                      >
                        {"下一页"}
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

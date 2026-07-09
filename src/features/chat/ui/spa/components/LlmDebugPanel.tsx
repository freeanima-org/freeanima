import {
  Badge,
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/frontend/ui-kit";
import type {
  LlmDebugSnapshotPayload,
  LlmDebugSnapshots,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

type LlmDebugPanelProps = {
  open: boolean;
  onClose: () => void;
  snapshots: LlmDebugSnapshots | null;
};

function TurnRow({
  turn,
  index,
}: {
  turn: LlmDebugSnapshotPayload["invoke"]["turns"][number];
  index: number;
}) {
  const isPassive = turn.role === "assistant" && turn.name === "passive_memory_context";
  const isNotification = turn.role === "assistant" && turn.name === "notification_context";
  const highlight = isPassive || isNotification;

  return (
    <Card className={highlight ? "border-primary/60 bg-primary/5 py-0" : "py-0"}>
      <CardContent className="space-y-1 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-muted-foreground">#{index + 1}</span>
          <Badge variant="outline">{turn.role}</Badge>
          {turn.name ? (
            <Badge variant={highlight ? "default" : "secondary"}>{turn.name}</Badge>
          ) : null}
        </div>
        {turn.content ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
            {turn.content}
          </pre>
        ) : null}
        {turn.tool_calls?.length ? (
          <div className="space-y-1">
            {turn.tool_calls.map((tc) => (
              <div
                key={tc.id}
                className="rounded border bg-muted/40 px-2 py-1 font-mono text-[11px]"
              >
                <div>{tc.name}</div>
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap">{tc.arguments}</pre>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SnapshotView({ snapshot }: { snapshot: LlmDebugSnapshotPayload | undefined }) {
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">{m.chat_llm_debug_empty()}</p>;
  }

  const passiveMissing =
    snapshot.phase === "initial" && !snapshot.runtime_injections?.passive_memory_context;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">
          {m.chat_llm_debug_model()}: {snapshot.model}
        </Badge>
        <Badge variant="secondary">
          {m.chat_llm_debug_turn_index()}: {snapshot.turn_index}
        </Badge>
        <Badge variant="secondary">
          {m.chat_llm_debug_tool_count()}: {snapshot.tool_count}
        </Badge>
      </div>

      {passiveMissing ? (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{m.chat_llm_debug_passive_missing()}</p>
          <p className="mt-1">{m.chat_llm_debug_passive_hint()}</p>
        </div>
      ) : null}

      {snapshot.runtime_injections?.passive_memory_context ||
      snapshot.runtime_injections?.notification_context ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {snapshot.runtime_injections.passive_memory_context ? (
            <Badge>passive_memory_context</Badge>
          ) : null}
          {snapshot.runtime_injections.notification_context ? (
            <Badge>notification_context</Badge>
          ) : null}
        </div>
      ) : null}

      {snapshot.tools.length > 0 ? (
        <Collapsible defaultOpen={snapshot.tools.length <= 8}>
          <CollapsibleTrigger className="text-sm font-medium hover:underline">
            {m.chat_llm_debug_tools()} ({snapshot.tools.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 max-h-40 space-y-1 overflow-auto">
            {snapshot.tools.map((tool) => (
              <div key={tool.name} className="rounded border px-2 py-1 text-xs">
                <div className="font-mono font-medium">{tool.name}</div>
                {tool.description ? (
                  <p className="text-muted-foreground">{tool.description}</p>
                ) : null}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {snapshot.invoke.system_prompt ? (
        <Collapsible>
          <CollapsibleTrigger className="text-sm font-medium hover:underline">
            {m.chat_llm_debug_system_prompt()}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 font-mono text-[11px]">
              {snapshot.invoke.system_prompt}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">{m.chat_llm_debug_turns()}</p>
        {snapshot.invoke.turns.map((turn, index) => (
          <TurnRow key={`${turn.role}-${turn.name ?? ""}-${index}`} turn={turn} index={index} />
        ))}
      </div>
    </div>
  );
}

/** 非模态侧栏：不遮挡聊天输入，可与发消息并行使用 */
export function LlmDebugPanel({ open, onClose, snapshots }: LlmDebugPanelProps) {
  if (!open) return null;

  return (
    <aside className="flex h-full w-full max-w-md shrink-0 flex-col border-l bg-background sm:w-96">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{m.chat_llm_debug_title()}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{m.chat_llm_debug_description()}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={onClose}
        >
          {m.console_common_close()}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <Tabs defaultValue="initial">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="initial">{m.chat_llm_debug_tab_initial()}</TabsTrigger>
            <TabsTrigger value="final">{m.chat_llm_debug_tab_final()}</TabsTrigger>
          </TabsList>
          <TabsContent value="initial" className="mt-3">
            <SnapshotView snapshot={snapshots?.initial} />
          </TabsContent>
          <TabsContent value="final" className="mt-3">
            <SnapshotView snapshot={snapshots?.final} />
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}

import { Link } from "@tanstack/react-router";
import { Badge, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { memoryTypeLabel } from "@freeanima/features/habitat/ui/habitat/lib/habitat-status.ts";
import type { MemoryRecallHit } from "./memory-recall-types.ts";

type BadgeVariant = "default" | "secondary" | "warning" | "ghost" | "outline";

function memoryTypeBadgeVariant(type: string): BadgeVariant {
  if (type === "semantic") return "default";
  if (type === "conversation") return "secondary";
  if (type === "limbic") return "warning";
  if (type === "autobiographical") return "secondary";
  return "ghost";
}

function ConversationLink({ conversationId }: { conversationId: string }) {
  return (
    <Link
      to="/conversations/$conversationId"
      params={{ conversationId }}
      className="text-primary underline-offset-4 hover:underline text-xs font-mono"
    >
      {conversationId}
    </Link>
  );
}

function ConversationLinks({ conversationIds }: { conversationIds: string[] }) {
  if (conversationIds.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-muted-foreground">{m.habitat_semantic_source_conversation()}: </span>
      {conversationIds.map((id, i) => (
        <span key={id}>
          {i > 0 ? ", " : null}
          <ConversationLink conversationId={id} />
        </span>
      ))}
    </p>
  );
}

export function RecallHitCard({ hit, index }: { hit: MemoryRecallHit; index: number }) {
  const label = memoryTypeLabel(hit.memory_type);
  const typeVariant = memoryTypeBadgeVariant(hit.memory_type);

  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4 gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold">{index + 1}.</span>
          <Badge variant={typeVariant} className="text-xs">
            {label}
          </Badge>
          <Badge variant="ghost" className="text-xs">
            score {hit.score.toFixed(4)}
          </Badge>
          {hit.memory_type === "semantic" ? (
            <>
              <span className="font-mono">{hit.semantic_memory_id}</span>
              <Badge variant="outline" className="text-xs">
                {hit.type}
              </Badge>
              <Badge variant="ghost" className="text-xs">
                {hit.status}
              </Badge>
              {hit.pinned ? (
                <Badge variant="warning" className="text-xs">
                  pinned
                </Badge>
              ) : null}
            </>
          ) : null}
          {hit.memory_type === "conversation" && hit.conversation_id ? (
            <>
              <Badge variant="outline" className="text-xs">
                {hit.role}
              </Badge>
              <ConversationLink conversationId={hit.conversation_id} />
              <span className="font-mono text-muted-foreground">{hit.message_id}</span>
              {hit.timestamp ? (
                <span className="text-muted-foreground">
                  {formatDisplayDateTime(hit.timestamp)}
                </span>
              ) : null}
            </>
          ) : null}
          {hit.memory_type === "limbic" ? (
            <>
              <span className="font-mono">{hit.limbic_memory_id}</span>
              <Badge variant="outline" className="text-xs">
                {hit.kind}
              </Badge>
              {hit.conversation_id ? (
                <ConversationLink conversationId={hit.conversation_id} />
              ) : null}
              <span className="text-muted-foreground">
                {m.habitat_limbic_intensity()} {hit.intensity}
                {hit.valence != null ? ` · v ${hit.valence}` : null}
                {hit.arousal != null ? ` · a ${hit.arousal}` : null}
              </span>
            </>
          ) : null}
          {hit.memory_type === "autobiographical" ? (
            <>
              <span className="font-mono">{hit.autobiographical_memory_id}</span>
              <Badge variant="outline" className="text-xs">
                {hit.significance}
              </Badge>
            </>
          ) : null}
        </div>
        {hit.memory_type === "semantic" ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
            <ConversationLinks conversationIds={hit.source_conversations ?? []} />
            {hit.observed_at || hit.occurred_at ? (
              <p className="text-xs text-muted-foreground font-mono">
                {hit.observed_at ? `observed ${formatDisplayDateTime(hit.observed_at)}` : null}
                {hit.observed_at && hit.occurred_at ? " · " : null}
                {hit.occurred_at ? `occurred ${hit.occurred_at}` : null}
              </p>
            ) : null}
          </>
        ) : null}
        {hit.memory_type === "conversation" ? (
          <p className="text-sm whitespace-pre-wrap">{hit.snippet}</p>
        ) : null}
        {hit.memory_type === "limbic" ? (
          <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
        ) : null}
        {hit.memory_type === "autobiographical" ? (
          <>
            <p className="text-sm font-medium">{hit.title}</p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{hit.snippet}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

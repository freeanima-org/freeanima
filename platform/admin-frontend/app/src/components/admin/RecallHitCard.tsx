import { Link } from "@tanstack/react-router";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";
import { memoryTypeLabel } from "@/lib/admin-status.ts";
import type { MemoryRecallHit } from "./memory-recall-types.ts";

function memoryTypeBadgeClass(type: string): string {
  if (type === "semantic") return "badge-primary";
  if (type === "conversation") return "badge-secondary";
  if (type === "limbic") return "badge-warning";
  if (type === "autobiographical") return "badge-accent";
  return "badge-ghost";
}

function ConversationLink({ conversationId }: { conversationId: string }) {
  return (
    <Link
      to="/conversations/$conversationId"
      params={{ conversationId }}
      className="link link-hover font-mono"
    >
      {conversationId}
    </Link>
  );
}

function ConversationLinks({ conversationIds }: { conversationIds: string[] }) {
  if (!conversationIds.length) return null;
  return (
    <p className="text-xs text-base-content/60">
      <span className="text-base-content/50">{m.admin_semantic_source_conversation()}: </span>
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
  const typeBadge = memoryTypeBadgeClass(hit.memory_type);

  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4 gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold">{index + 1}.</span>
          <span className={`badge ${typeBadge} badge-xs`}>{label}</span>
          <span className="badge badge-ghost badge-xs">score {hit.score.toFixed(4)}</span>
          {hit.memory_type === "semantic" ? (
            <>
              <span className="font-mono">{hit.semantic_memory_id}</span>
              <span className="badge badge-outline badge-xs">{hit.type}</span>
              <span className="badge badge-ghost badge-xs">{hit.status}</span>
              {hit.pinned ? <span className="badge badge-warning badge-xs">pinned</span> : null}
            </>
          ) : null}
          {hit.memory_type === "conversation" && hit.conversation_id ? (
            <>
              <span className="badge badge-outline badge-xs">{hit.role}</span>
              <ConversationLink conversationId={hit.conversation_id} />
              <span className="font-mono text-base-content/60">{hit.message_id}</span>
              {hit.timestamp ? (
                <span className="text-base-content/50">{formatDisplayDateTime(hit.timestamp)}</span>
              ) : null}
            </>
          ) : null}
          {hit.memory_type === "limbic" ? (
            <>
              <span className="font-mono">{hit.limbic_memory_id}</span>
              <span className="badge badge-outline badge-xs">{hit.kind}</span>
              {hit.conversation_id ? (
                <ConversationLink conversationId={hit.conversation_id} />
              ) : null}
              <span className="text-base-content/50">
                {m.admin_limbic_intensity()} {hit.intensity}
                {hit.valence != null ? ` · v ${hit.valence}` : null}
                {hit.arousal != null ? ` · a ${hit.arousal}` : null}
              </span>
            </>
          ) : null}
          {hit.memory_type === "autobiographical" ? (
            <>
              <span className="font-mono">{hit.autobiographical_memory_id}</span>
              <span className="badge badge-outline badge-xs">{hit.significance}</span>
            </>
          ) : null}
        </div>
        {hit.memory_type === "semantic" ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{hit.content}</p>
            <ConversationLinks conversationIds={hit.source_conversations ?? []} />
            {hit.observed_at || hit.occurred_at ? (
              <p className="text-xs text-base-content/60 font-mono">
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
            <p className="text-sm whitespace-pre-wrap text-base-content/80">{hit.snippet}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

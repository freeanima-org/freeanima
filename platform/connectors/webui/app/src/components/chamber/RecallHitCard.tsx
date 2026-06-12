import { Link } from "@tanstack/react-router";
import { m } from "@/lib/i18n.ts";
import { memoryTypeLabel } from "@/lib/webui-status.ts";
import type { MemoryRecallHit } from "./memory-recall-types.ts";

function memoryTypeBadgeClass(type: string): string {
  if (type === "semantic") return "badge-primary";
  if (type === "session") return "badge-secondary";
  if (type === "limbic") return "badge-warning";
  if (type === "autobiographical") return "badge-accent";
  return "badge-ghost";
}

function SessionLink({ sessionId }: { sessionId: string }) {
  return (
    <Link
      to="/chamber/sessions/$sessionId"
      params={{ sessionId }}
      className="link link-hover font-mono"
    >
      {sessionId}
    </Link>
  );
}

function SessionLinks({ sessionIds }: { sessionIds: string[] }) {
  if (!sessionIds.length) return null;
  return (
    <p className="text-xs text-base-content/60">
      <span className="text-base-content/50">{m.webui_chamber_semantic_source_session()}: </span>
      {sessionIds.map((id, i) => (
        <span key={id}>
          {i > 0 ? ", " : null}
          <SessionLink sessionId={id} />
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
          {hit.memory_type === "session" && hit.session_id ? (
            <>
              <span className="badge badge-outline badge-xs">{hit.role}</span>
              <SessionLink sessionId={hit.session_id} />
              <span className="font-mono text-base-content/60">{hit.message_id}</span>
              {hit.timestamp ? (
                <span className="text-base-content/50">{String(hit.timestamp).slice(0, 19)}</span>
              ) : null}
            </>
          ) : null}
          {hit.memory_type === "limbic" ? (
            <>
              <span className="font-mono">{hit.limbic_memory_id}</span>
              <span className="badge badge-outline badge-xs">{hit.kind}</span>
              {hit.session_id ? <SessionLink sessionId={hit.session_id} /> : null}
              <span className="text-base-content/50">
                {m.webui_chamber_limbic_intensity()} {hit.intensity}
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
            <SessionLinks sessionIds={hit.source_sessions ?? []} />
            {hit.observed_at || hit.occurred_at ? (
              <p className="text-xs text-base-content/60 font-mono">
                {hit.observed_at ? `observed ${String(hit.observed_at).slice(0, 19)}` : null}
                {hit.observed_at && hit.occurred_at ? " · " : null}
                {hit.occurred_at ? `occurred ${hit.occurred_at}` : null}
              </p>
            ) : null}
          </>
        ) : null}
        {hit.memory_type === "session" ? (
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

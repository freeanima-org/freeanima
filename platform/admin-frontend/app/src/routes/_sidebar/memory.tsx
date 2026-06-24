import { createFileRoute, Link } from "@tanstack/react-router";
import type { ServiceStatus } from "@freeanima/admin-api/api";
import { useMemo, useState } from "react";
import { formatMemoryRecallOutput } from "@/components/admin/format-memory-recall-output.ts";
import {
  countByMemoryType,
  MEMORY_RECALL_TYPES,
  recallHitKey,
  type MemoryRecallResult,
  type MemoryRecallType,
} from "@/components/admin/memory-recall-types.ts";
import { RecallHitCard } from "@/components/admin/RecallHitCard.tsx";
import { m } from "@/lib/i18n.ts";
import { getStatus, searchMemory } from "@/lib/api.ts";
import { memoryTypeLabel } from "@/lib/admin-status.ts";

export const Route = createFileRoute("/_sidebar/memory")({
  loader: async () => {
    const status = await getStatus().catch(() => null);
    return { status };
  },
  component: MemoryPage,
});

const QUICK_LINKS = [
  { to: "/semantic-memory", label: () => m.admin_nav_semantic() },
  { to: "/limbic-memory", label: () => m.admin_nav_limbic() },
  { to: "/autobiographical-memory", label: () => m.admin_nav_autobio() },
  { to: "/fts", label: () => m.admin_nav_fts() },
  { to: "/conversations", label: () => m.admin_nav_conversations() },
] as const;

function MemoryPage() {
  const { status } = Route.useLoaderData();
  const svc = status as ServiceStatus | null;
  const semanticMemoryCount = svc?.memory?.semantic_memory_count ?? 0;
  const dialogueMessageCount = svc?.memory?.dialogue_message_count ?? 0;

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MemoryRecallType | "all">("all");
  const [result, setResult] = useState<MemoryRecallResult>({
    query: "",
    limit: 10,
    results: [],
    summary: "",
  });

  const typeCounts = useMemo(() => countByMemoryType(result.results), [result.results]);

  const filteredResults = useMemo(() => {
    if (typeFilter === "all") return result.results;
    return result.results.filter((hit) => hit.memory_type === typeFilter);
  }, [result.results, typeFilter]);

  const isEmpty = !result.results.length;
  const toolPreview = useMemo(() => formatMemoryRecallOutput(result), [result]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    setTypeFilter("all");
    try {
      const d = (await searchMemory({ query: q, limit })) as MemoryRecallResult;
      setResult(d);
      setLastQuery(q);
      setSearched(true);
    } catch (e) {
      setError(
        m.admin_common_search_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">{m.admin_nav_memory()}</h2>
        <p className="text-sm text-base-content/60 mt-1">{m.admin_memory_desc()}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="card bg-base-200">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-base-content/60">{m.admin_dashboard_semantic_memory()}</p>
            <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            <p className="text-xs text-base-content/50 mt-1">
              {m.admin_api_semantic_memory_count({ count: String(semanticMemoryCount) })}
            </p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-base-content/60">{m.admin_dashboard_dialogue_messages()}</p>
            <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-base-content/60 mb-1.5">{m.admin_memory_quick_links()}</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="btn btn-xs btn-outline">
              {link.label()}
            </Link>
          ))}
        </div>
      </div>

      <form
        className="card bg-base-200 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <div className="card-body gap-3">
          <div className="form-control">
            <label className="label py-0">
              <span className="label-text text-xs">{m.admin_memory_query_required()}</span>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              className="input input-bordered input-sm font-mono"
              placeholder={m.admin_common_keyword_placeholder()}
              autoFocus
            />
          </div>
          <div className="form-control max-w-xs">
            <label className="label py-0">
              <span className="label-text text-xs">{m.admin_memory_top_n()}</span>
            </label>
            <input
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              type="number"
              min={1}
              max={20}
              className="input input-bordered input-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={searching || !query.trim()}
            >
              {searching ? <span className="loading loading-spinner loading-xs" /> : null}
              {m.admin_common_search()}
            </button>
            {searched && !searching ? (
              <span className="text-xs text-base-content/50">
                「{lastQuery}」— {result.summary}
              </span>
            ) : null}
          </div>
        </div>
      </form>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {searched && !searching && isEmpty ? (
        <div className="alert alert-info text-sm">
          {m.admin_memory_not_found({ query: lastQuery })}
        </div>
      ) : null}

      {searched && !isEmpty ? (
        <div className="space-y-4">
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold">
                {m.admin_memory_recall_results()}
                <span className="badge badge-ghost badge-sm ml-1">{result.results.length}</span>
              </h3>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`badge badge-sm cursor-pointer ${typeFilter === "all" ? "badge-primary" : "badge-ghost"}`}
                  onClick={() => setTypeFilter("all")}
                >
                  {m.admin_memory_type_filter_all()} {result.results.length}
                </button>
                {MEMORY_RECALL_TYPES.map((type) => {
                  const count = typeCounts[type] ?? 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`badge badge-sm cursor-pointer ${typeFilter === type ? "badge-primary" : "badge-ghost"}`}
                      onClick={() => setTypeFilter(type)}
                    >
                      {memoryTypeLabel(type)} {count}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              {filteredResults.length === 0 ? (
                <p className="text-sm text-base-content/50">{m.admin_common_no_results()}</p>
              ) : (
                filteredResults.map((hit, idx) => (
                  <RecallHitCard key={recallHitKey(hit)} hit={hit} index={idx} />
                ))
              )}
            </div>
          </section>

          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title text-xs font-mono text-base-content/60 min-h-0 py-3">
              {m.admin_memory_raw_preview()}
            </summary>
            <div className="collapse-content">
              <pre className="text-xs bg-base-300 p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">
                {toolPreview}
              </pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

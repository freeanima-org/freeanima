import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import type { ServiceSnapshot } from "@freeanima/shared/rpc-contract/frames/snapshot.ts";
import { Badge, Button, Card, CardContent, Input, Spinner } from "@freeanima/ui-kit";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { cn } from "@freeanima/ui-kit/lib/utils.ts";
import { useMemo, useState } from "react";
import { formatMemoryRecallOutput } from "@freeanima/features/habitat/ui/habitat/components/habitat/format-memory-recall-output.ts";
import {
  countByMemoryType,
  MEMORY_RECALL_TYPES,
  recallHitKey,
  type MemoryRecallResult,
  type MemoryRecallType,
} from "@freeanima/features/habitat/ui/habitat/components/habitat/memory-recall-types.ts";
import { RecallHitCard } from "@freeanima/features/habitat/ui/habitat/components/habitat/RecallHitCard.tsx";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { getStatus, searchMemory } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { memoryTypeLabel } from "@freeanima/features/habitat/ui/habitat/lib/habitat-status.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/memory")({
  loader: async () => {
    const status = await getStatus().catch(catchWithFallback("memory/getStatus", null));
    return { status };
  },
  component: MemoryPage,
});

const QUICK_LINKS = [
  { to: "/semantic-memory", label: () => m.habitat_nav_semantic() },
  { to: "/limbic-memory", label: () => m.habitat_nav_limbic() },
  { to: "/autobiographical-memory", label: () => m.habitat_nav_autobio() },
  { to: "/fts", label: () => m.habitat_nav_fts() },
  { to: "/conversations", label: () => m.habitat_nav_conversations() },
] as const;

const MEMORY_BROWSE_TABS = [
  { to: "/memory", label: () => m.habitat_nav_memory() },
  { to: "/semantic-memory", label: () => m.habitat_nav_semantic() },
  { to: "/limbic-memory", label: () => m.habitat_nav_limbic() },
  { to: "/autobiographical-memory", label: () => m.habitat_nav_autobio() },
  { to: "/conversations", label: () => m.habitat_nav_conversations() },
  { to: "/fts", label: () => m.habitat_nav_fts() },
] as const;

function MemoryBrowseTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="bg-muted text-muted-foreground inline-flex h-auto w-fit flex-wrap items-center justify-center rounded-lg p-[3px] mb-4 gap-1">
      {MEMORY_BROWSE_TABS.map((tab) => {
        const active =
          tab.to === "/memory"
            ? pathname === "/memory"
            : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label()}
          </Link>
        );
      })}
    </div>
  );
}

function MemoryPage() {
  const { status } = Route.useLoaderData();
  const svc = status as ServiceSnapshot | null;
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

  const isEmpty = result.results.length === 0;
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
      logCaughtError("routes/_sidebar/memory", e);
      setError(
        m.habitat_common_search_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <MemoryBrowseTabs />
      <div className="mb-4">
        <h2 className="text-lg font-bold">{m.habitat_nav_memory()}</h2>
        <p className="text-sm text-muted-foreground mt-1">{m.habitat_memory_desc()}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card className="bg-muted py-0">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{m.habitat_dashboard_semantic_memory()}</p>
            <p className="text-xl font-mono mt-1">{semanticMemoryCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {m.habitat_api_semantic_memory_count({ count: String(semanticMemoryCount) })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted py-0">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">
              {m.habitat_dashboard_dialogue_messages()}
            </p>
            <p className="text-xl font-mono mt-1">{dialogueMessageCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1.5">{m.habitat_memory_quick_links()}</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Button key={link.to} variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link to={link.to}>{link.label()}</Link>
            </Button>
          ))}
        </div>
      </div>

      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <Card className="bg-muted py-0">
          <CardContent className="gap-3 py-4 px-4">
            <FormFieldset bordered={false} className="gap-3">
              <FormField label={m.habitat_memory_query_required()} className="text-xs">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  className="h-8 font-mono"
                  placeholder={m.habitat_common_keyword_placeholder()}
                  focusOnMount
                />
              </FormField>
              <FormField label={m.habitat_memory_top_n()} className="max-w-xs text-xs">
                <Input
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  type="number"
                  min={1}
                  max={20}
                  className="h-8"
                />
              </FormField>
            </FormFieldset>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={searching || !query.trim()}>
                {searching ? <Spinner /> : null}
                {m.habitat_common_search()}
              </Button>
              {searched && !searching ? (
                <span className="text-xs text-muted-foreground">
                  「{lastQuery}」— {result.summary}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </form>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {searched && !searching && isEmpty ? (
        <StatusAlert variant="info">{m.habitat_memory_not_found({ query: lastQuery })}</StatusAlert>
      ) : null}

      {searched && !isEmpty ? (
        <div className="space-y-4">
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold">
                {m.habitat_memory_recall_results()}
                <Badge variant="ghost" className="text-xs ml-1">
                  {result.results.length}
                </Badge>
              </h3>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={typeFilter === "all" ? "default" : "ghost"}
                  className="text-xs cursor-pointer"
                  onClick={() => setTypeFilter("all")}
                >
                  {m.habitat_memory_type_filter_all()} {result.results.length}
                </Badge>
                {MEMORY_RECALL_TYPES.map((type) => {
                  const count = typeCounts[type] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Badge
                      key={type}
                      variant={typeFilter === type ? "default" : "ghost"}
                      className="text-xs cursor-pointer"
                      onClick={() => setTypeFilter(type)}
                    >
                      {memoryTypeLabel(type)} {count}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              {filteredResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.habitat_common_no_results()}</p>
              ) : (
                filteredResults.map((hit, idx) => (
                  <RecallHitCard key={recallHitKey(hit)} hit={hit} index={idx} />
                ))
              )}
            </div>
          </section>

          <details className="rounded-lg bg-muted">
            <summary className="text-xs font-mono text-muted-foreground cursor-pointer py-3 px-4">
              {m.habitat_memory_raw_preview()}
            </summary>
            <div className="px-4 pb-4">
              <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">
                {toolPreview}
              </pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

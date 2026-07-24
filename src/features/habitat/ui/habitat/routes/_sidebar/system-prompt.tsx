import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ConversationSummary } from "@freeanima/shared/rpc-contract/frames/snapshot.ts";
import type { PromptDebugResponse } from "@freeanima/features/habitat/protocol/habitat-contract/api/response-types.ts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { useEffect, useMemo, useState } from "react";
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  getPromptDebug,
  listConversations,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

type TabId = "parts" | "full" | "tools";

const TOOLS_PAGE_SIZE = 20;

const PART_KEYS = ["self", "toolsets", "resident", "agents"] as const;
type PartKey = (typeof PART_KEYS)[number];

const PART_BREAKDOWN_KEY = {
  self: "system_self",
  toolsets: "system_toolsets",
  resident: "system_resident",
  agents: "system_agents",
} as const;

function partLabel(key: PartKey): string {
  if (key === "self") return m.habitat_system_prompt_block_self();
  if (key === "toolsets") return m.habitat_system_prompt_block_toolsets();
  if (key === "resident") return m.habitat_system_prompt_block_resident();
  return m.habitat_system_prompt_block_agents();
}

function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

function estimateChars(text: string): number {
  return text.length;
}

export const Route = createFileRoute("/_sidebar/system-prompt")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } =>
    omitUndefined({
      conversation:
        typeof search.conversation === "string" && search.conversation
          ? search.conversation
          : undefined,
    }),
  component: SystemPromptPage,
});

function ToolSchemaCard({ tool }: { tool: PromptDebugResponse["tools"]["items"][number] }) {
  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold break-all">{tool.name}</h3>
          {tool.toolset ? (
            <Badge variant="ghost" className="text-xs shrink-0">
              {tool.toolset}
            </Badge>
          ) : null}
        </div>
        {tool.description ? (
          <p className="text-xs text-muted-foreground">{tool.description}</p>
        ) : null}
        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-muted-foreground">
            {m.habitat_tools_param_schema()}
          </summary>
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function BreakdownBar({ data }: { data: PromptDebugResponse["system"]["breakdown"] }) {
  const systemTotal =
    data.system_self + data.system_agents + data.system_resident + data.system_toolsets;
  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4 gap-2">
        <h3 className="text-sm font-semibold">{m.habitat_system_prompt_token_breakdown()}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{m.habitat_system_prompt_token_system()}</span>
            <div className="font-mono">~{formatTokenK(systemTotal)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              {m.habitat_system_prompt_token_messages()}
            </span>
            <div className="font-mono">~{formatTokenK(data.messages)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{m.habitat_system_prompt_token_tools()}</span>
            <div className="font-mono">~{formatTokenK(data.tools)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{m.habitat_system_prompt_token_total()}</span>
            <div className="font-mono font-semibold">~{formatTokenK(data.total)}</div>
          </div>
        </div>
        {(data.system_self > 0 ||
          data.system_toolsets > 0 ||
          data.system_agents > 0 ||
          data.system_resident > 0) && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {data.system_self > 0 ? (
              <span>
                {m.habitat_system_prompt_block_self()} ~{formatTokenK(data.system_self)}
              </span>
            ) : null}
            {data.system_toolsets > 0 ? (
              <span>
                {m.habitat_system_prompt_block_toolsets()} ~{formatTokenK(data.system_toolsets)}
              </span>
            ) : null}
            {data.system_resident > 0 ? (
              <span>
                {m.habitat_system_prompt_block_resident()} ~{formatTokenK(data.system_resident)}
              </span>
            ) : null}
            {data.system_agents > 0 ? (
              <span>
                {m.habitat_system_prompt_block_agents()} ~{formatTokenK(data.system_agents)}
              </span>
            ) : null}
            {data.summary > 0 ? (
              <span>
                {m.habitat_system_prompt_block_summary()} ~{formatTokenK(data.summary)}
              </span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemPromptPage() {
  const { conversation: conversationFromUrl } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [tab, setTab] = useState<TabId>("parts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PromptDebugResponse | null>(null);
  const [toolQuery, setToolQuery] = useState("");
  const [toolsPage, setToolsPage] = useState(1);
  const [copyHint, setCopyHint] = useState("");

  const selectedConversation = conversationFromUrl ?? "";

  useEffect(() => {
    void listConversations({ offset: 0, limit: 100 })
      .then((resp) => {
        setRecentConversations(
          (resp as { conversations?: ConversationSummary[] }).conversations ?? [],
        );
      })
      .catch((err) => {
        logCaughtError("system-prompt/listConversations", err);
        setRecentConversations([]);
      });
  }, []);

  useEffect(() => {
    setToolsPage(1);
  }, [toolQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getPromptDebug(selectedConversation || undefined)
      .then((result) => {
        if (!cancelled) setData(result as PromptDebugResponse);
      })
      .catch((e) => {
        logCaughtError("system-prompt/getPromptDebug", e);
        if (!cancelled) {
          setData(null);
          setError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedConversation]);

  const sortedConversations = recentConversations;

  const filteredTools = useMemo(() => {
    const items = data?.tools.items ?? [];
    const q = toolQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.toolset?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.tools.items, toolQuery]);

  const pagedTools = useMemo(() => {
    const start = (toolsPage - 1) * TOOLS_PAGE_SIZE;
    return filteredTools.slice(start, start + TOOLS_PAGE_SIZE);
  }, [filteredTools, toolsPage]);

  const handleConversationChange = (value: string) => {
    void navigate({
      search: value ? { conversation: value } : {},
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(m.habitat_common_copied({ label }));
      setTimeout(() => setCopyHint(""), 2000);
    } catch (err) {
      logCaughtError("system-prompt/copyText", err);
      setCopyHint(m.habitat_common_copy_failed({ label: "" }));
      setTimeout(() => setCopyHint(""), 2000);
    }
  };

  const toolsMode =
    data?.tools.mode === "registry"
      ? m.habitat_system_prompt_tools_registry()
      : m.habitat_system_prompt_tools_effective();

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.habitat_nav_system_prompt()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.habitat_system_prompt_desc()}</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <FormField
          label={m.habitat_system_prompt_conversation_optional()}
          className="w-full max-w-xl text-xs"
        >
          <Select
            value={selectedConversation || "__global__"}
            onValueChange={(v) => handleConversationChange(v === "__global__" ? "" : v)}
          >
            <SelectTrigger size="sm" className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__global__">{m.habitat_common_global_template()}</SelectItem>
              {sortedConversations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {(s.title || m.habitat_common_no_title()).slice(0, 24)} · {s.id.slice(0, 20)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {selectedConversation ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link
              to="/conversations/$conversationId"
              params={{ conversationId: selectedConversation }}
            >
              {m.habitat_system_prompt_conversation_detail()}
            </Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/self-layer">{m.habitat_system_prompt_self_layer()}</Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/tools">{m.habitat_system_prompt_tools_list()}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{m.habitat_common_loading()}</div>
      ) : null}
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {data && !loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="ghost" className="text-xs">
              {data.mode === "global"
                ? m.habitat_system_prompt_mode_global()
                : m.habitat_system_prompt_mode_conversation()}
            </Badge>
            <Badge variant="ghost" className="text-xs">
              {m.habitat_system_prompt_tools_count({
                count: String(data.tools.count),
                mode: toolsMode,
              })}
            </Badge>
            {data.mode === "conversation" && data.system.in_sync !== undefined ? (
              <Badge variant={data.system.in_sync ? "success" : "warning"} className="text-xs">
                {data.system.in_sync
                  ? m.habitat_common_stored_live_sync()
                  : m.habitat_common_stored_live_diff()}
              </Badge>
            ) : null}
            {copyHint ? (
              <span className="text-xs text-green-700 dark:text-green-300">{copyHint}</span>
            ) : null}
          </div>

          {data.meta ? (
            <div className="text-xs text-muted-foreground mb-4 space-y-1">
              {data.meta.cwd ? (
                <div>
                  cwd: <code className="text-xs">{data.meta.cwd}</code>
                </div>
              ) : null}
              {data.meta.capability_mask?.presets.length ? (
                <div>capability_mask: {data.meta.capability_mask.presets.join(", ")}</div>
              ) : null}
              {data.meta.tool_names?.length ? (
                <div>
                  {m.habitat_system_prompt_meta_tools({
                    count: String(data.meta.tool_names.length),
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <BreakdownBar data={data.system.breakdown} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mb-4">
            <TabsList className="w-fit">
              {(
                [
                  ["parts", m.habitat_system_prompt_tab_parts()],
                  ["full", m.habitat_system_prompt_tab_full()],
                  ["tools", m.habitat_system_prompt_tab_tools()],
                ] as const
              ).map(([id, label]) => (
                <TabsTrigger key={id} value={id}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="parts" className="space-y-4 mt-4">
              {PART_KEYS.map((key) => {
                const text = data.system.parts[key];
                return (
                  <details key={key} className="group rounded-lg bg-muted" open>
                    <summary className="cursor-pointer list-none py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm">{partLabel(key)}</h3>
                        <span className="text-xs text-muted-foreground">
                          {m.habitat_common_chars_estimate({
                            chars: String(estimateChars(text)),
                            tokens: formatTokenK(data.system.breakdown[PART_BREAKDOWN_KEY[key]]),
                          })}
                        </span>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-96 overflow-auto">
                        {text.trim() || m.habitat_common_empty()}
                      </pre>
                    </div>
                  </details>
                );
              })}
            </TabsContent>

            <TabsContent value="full" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void copyText(data.system.composed, " live prompt")}
                >
                  {m.habitat_system_prompt_copy_live()}
                </Button>
                {data.system.stored != null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void copyText(data.system.stored ?? "", " stored prompt")}
                  >
                    {m.habitat_system_prompt_copy_stored()}
                  </Button>
                ) : null}
              </div>
              {data.mode === "conversation" && data.system.stored != null ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <section>
                    <h3 className="text-sm font-semibold mb-2">{m.habitat_system_prompt_live()}</h3>
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.composed || m.habitat_common_empty()}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold mb-2">
                      {m.habitat_system_prompt_stored()}
                    </h3>
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.stored || m.habitat_common_empty()}
                    </pre>
                  </section>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                  {data.system.composed || m.habitat_common_empty()}
                </pre>
              )}
            </TabsContent>

            <TabsContent value="tools" className="mt-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Input
                  type="search"
                  className="w-full max-w-sm h-8"
                  placeholder={m.habitat_system_prompt_search_tools()}
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    void copyText(JSON.stringify(data.tools.items, null, 2), " tool schema JSON")
                  }
                >
                  {m.habitat_system_prompt_copy_json()}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {m.habitat_system_prompt_tools_shown({
                    shown: String(filteredTools.length),
                    total: String(data.tools.count),
                    tokens: formatTokenK(data.tools.tokens_est),
                  })}
                </span>
              </div>
              <div className="space-y-2">
                {pagedTools.map((tool) => (
                  <ToolSchemaCard key={tool.name} tool={tool} />
                ))}
                {filteredTools.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {m.habitat_system_prompt_no_tools()}
                  </div>
                ) : null}
                <MemoryListPagination
                  total={filteredTools.length}
                  pageSize={TOOLS_PAGE_SIZE}
                  currentPage={toolsPage}
                  onPageChange={setToolsPage}
                />
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

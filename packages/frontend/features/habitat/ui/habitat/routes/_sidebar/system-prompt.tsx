import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Key } from "react-aria-components";
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
  buttonVariants,
  cn,
} from "@freeanima/ui-kit";
import { useEffect, useMemo, useState } from "react";
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  getPromptDebug,
  listConversations,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
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
  if (key === "self") return "自我层";
  if (key === "toolsets") return "ToolSets";
  if (key === "resident") return "常驻记忆";
  return "AGENTS.md";
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
            {"参数 schema"}
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
        <h3 className="text-sm font-semibold">{"Token 分项（粗估）"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{"系统提示词"}</span>
            <div className="font-mono">~{formatTokenK(systemTotal)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{"对话消息"}</span>
            <div className="font-mono">~{formatTokenK(data.messages)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{"工具 schema"}</span>
            <div className="font-mono">~{formatTokenK(data.tools)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{"合计"}</span>
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
                {"自我层"} ~{formatTokenK(data.system_self)}
              </span>
            ) : null}
            {data.system_toolsets > 0 ? (
              <span>
                {"ToolSets"} ~{formatTokenK(data.system_toolsets)}
              </span>
            ) : null}
            {data.system_resident > 0 ? (
              <span>
                {"常驻记忆"} ~{formatTokenK(data.system_resident)}
              </span>
            ) : null}
            {data.system_agents > 0 ? (
              <span>
                {"AGENTS.md"} ~{formatTokenK(data.system_agents)}
              </span>
            ) : null}
            {data.summary > 0 ? (
              <span>
                {"摘要"} ~{formatTokenK(data.summary)}
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
      setCopyHint(`已复制${label}`);
      setTimeout(() => setCopyHint(""), 2000);
    } catch (err) {
      logCaughtError("system-prompt/copyText", err);
      setCopyHint("复制失败");
      setTimeout(() => setCopyHint(""), 2000);
    }
  };

  const toolsMode = data?.tools.mode === "registry" ? "全量注册表" : "对话有效";

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{"📋 系统提示词"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {
          "查看系统提示词分解、完整文本与会话有效工具 schema。默认全局模板；可选 conversation 对比 PG 持久化与实时重建结果。"
        }
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <FormField label={"对话（可选）"} className="w-full max-w-xl text-xs">
          <Select
            selectedKey={selectedConversation || "__global__"}
            onSelectionChange={(key) => {
              if (key == null) return;
              const v = String(key);
              handleConversationChange(v === "__global__" ? "" : v);
            }}
          >
            <SelectTrigger size="sm" className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem id="__global__">{"— 全局模板 —"}</SelectItem>
              {sortedConversations.map((s) => (
                <SelectItem key={s.id} id={s.id}>
                  {(s.title || "（无标题）").slice(0, 24)} · {s.id.slice(0, 20)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {selectedConversation ? (
          <Link
            to="/conversations/$conversationId"
            params={{ conversationId: selectedConversation }}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
          >
            {"对话详情 →"}
          </Link>
        ) : null}
        <Link
          to="/self-layer"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
        >
          {"自我层 →"}
        </Link>
        <Link
          to="/tools"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}
        >
          {"工具列表 →"}
        </Link>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">{"加载中…"}</div> : null}
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {data && !loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="ghost" className="text-xs">
              {data.mode === "global" ? "全局模板" : "对话对比"}
            </Badge>
            <Badge variant="ghost" className="text-xs">
              {`工具 ${String(data.tools.count)} 个（${toolsMode}）`}
            </Badge>
            {data.mode === "conversation" && data.system.in_sync !== undefined ? (
              <Badge variant={data.system.in_sync ? "success" : "warning"} className="text-xs">
                {data.system.in_sync ? "stored 与 live 一致" : "stored 与 live 不一致"}
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
              {data.meta.tool_names?.length ? (
                <div>
                  {`conversation_meta.tools: ${String(data.meta.tool_names.length)} 个名称`}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <BreakdownBar data={data.system.breakdown} />
          </div>

          <Tabs
            selectedKey={tab}
            onSelectionChange={(key: Key) => {
              if (key != null) setTab(String(key) as TabId);
            }}
            className="mb-4"
          >
            <TabsList className="w-fit">
              {(
                [
                  ["parts", "分项"],
                  ["full", "完整文本"],
                  ["tools", "工具 schema"],
                ] as const
              ).map(([id, label]) => (
                <TabsTrigger key={id} id={id}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent id="parts" className="space-y-4 mt-4">
              {PART_KEYS.map((key) => {
                const text = data.system.parts[key];
                return (
                  <details key={key} className="group rounded-lg bg-muted" open>
                    <summary className="cursor-pointer list-none py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm">{partLabel(key)}</h3>
                        <span className="text-xs text-muted-foreground">
                          {`${String(estimateChars(text))} 字符 · ~${formatTokenK(data.system.breakdown[PART_BREAKDOWN_KEY[key]])} tokens`}
                        </span>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-96 overflow-auto">
                        {text.trim() || "（空）"}
                      </pre>
                    </div>
                  </details>
                );
              })}
            </TabsContent>

            <TabsContent id="full" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void copyText(data.system.composed, " live prompt")}
                >
                  {"复制 live 全文"}
                </Button>
                {data.system.stored != null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void copyText(data.system.stored ?? "", " stored prompt")}
                  >
                    {"复制 stored 全文"}
                  </Button>
                ) : null}
              </div>
              {data.mode === "conversation" && data.system.stored != null ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <section>
                    <h3 className="text-sm font-semibold mb-2">{"Live（实时重建）"}</h3>
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.composed || "（空）"}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold mb-2">{"Stored（PG）"}</h3>
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.stored || "（空）"}
                    </pre>
                  </section>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded max-h-[32rem] overflow-auto">
                  {data.system.composed || "（空）"}
                </pre>
              )}
            </TabsContent>

            <TabsContent id="tools" className="mt-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Input
                  type="search"
                  className="w-full max-w-sm h-8"
                  placeholder={"搜索工具名 / 描述 / toolset"}
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
                  {"复制 JSON"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {`显示 ${String(filteredTools.length)} / ${String(data.tools.count)} · ~${formatTokenK(data.tools.tokens_est)} tokens`}
                </span>
              </div>
              <div className="space-y-2">
                {pagedTools.map((tool) => (
                  <ToolSchemaCard key={tool.name} tool={tool} />
                ))}
                {filteredTools.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{"无匹配工具"}</div>
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

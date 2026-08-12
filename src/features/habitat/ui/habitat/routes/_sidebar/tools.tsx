import { createFileRoute } from "@tanstack/react-router";
import type {
  ToolsStatusResponse,
  ToolsStatusToolItem,
} from "@freeanima/features/habitat/protocol/habitat-contract/api/response-types.ts";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { useMemo, useState } from "react";
import { getToolsStatus } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import { catchWithFallback } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

type ToolsLoaderData = ToolsStatusResponse;

const EMPTY_LOADER_DATA: ToolsLoaderData = { default_toolsets: [], tools: [], toolsets: [] };
const TOOLS_PAGE_SIZE = 20;
const LONG_STALE_MS = 5 * 60_000;

const STATIC_TOOLSET_ORDER = ["toolset", "memory"] as const;

function toolSetSortKey(name: string): [number, string] {
  const idx = STATIC_TOOLSET_ORDER.indexOf(name as (typeof STATIC_TOOLSET_ORDER)[number]);
  if (idx >= 0) return [idx, name];
  return [STATIC_TOOLSET_ORDER.length, name];
}

function sortToolSets(toolSets: ToolsLoaderData["toolsets"]): ToolsLoaderData["toolsets"] {
  return toolSets.toSorted((a, b) => {
    const ka = toolSetSortKey(a.name);
    const kb = toolSetSortKey(b.name);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1].localeCompare(kb[1]);
  });
}

function returnKindLabel(kind: ToolsStatusToolItem["return_kind"]): string {
  return kind === "text" ? "纯文本" : "结构化 JSON";
}

function returnKindHint(kind: ToolsStatusToolItem["return_kind"]): string {
  return kind === "text"
    ? "成功时返回纯文本；失败时返回 JSON error"
    : "成功时返回 toolResult JSON 对象；失败时返回 JSON error";
}

function isDynamicRemoteTool(tool: ToolsStatusToolItem): boolean {
  const ts = tool.toolset ?? "";
  return ts.startsWith("mcp_") || ts.startsWith("acp_");
}

function formatReturnExample(tool: ToolsStatusToolItem): string {
  if (tool.return_example === undefined) return "";
  if (tool.return_kind === "text" && typeof tool.return_example === "string") {
    return tool.return_example;
  }
  return JSON.stringify(tool.return_example, null, 2);
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    console.info(`已复制${label}`);
  } catch {
    console.warn(`复制${label}失败`);
  }
}

export const Route = createFileRoute("/_sidebar/tools")({
  loader: () =>
    getToolsStatus().catch(
      catchWithFallback("tools/getToolsStatus", EMPTY_LOADER_DATA),
    ) as Promise<ToolsLoaderData>,
  staleTime: LONG_STALE_MS,
  component: ToolsPage,
});

function DefaultToolSetsSection({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <Card className="bg-muted py-0 mb-4">
      <CardContent className="py-3 px-4 gap-2">
        <h3 className="text-sm font-semibold">{"默认加载工具集"}</h3>
        <p className="text-xs text-muted-foreground">
          {
            "新会话自动注入 LLM tools 参数的默认工具集（通过 toolset_load 按需加载的工具集不在此列）。"
          }
        </p>
        <div className="flex flex-wrap gap-1">
          {names.map((name) => (
            <Badge key={name} className="text-xs font-mono">
              {name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ToolCard({ tool }: { tool: ToolsStatusToolItem }) {
  const exampleText = formatReturnExample(tool);
  const missingContract = !tool.return_schema && !isDynamicRemoteTool(tool);

  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold break-all">{tool.name}</h3>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            <Badge variant="secondary" className="text-xs">
              {returnKindLabel(tool.return_kind)}
            </Badge>
            {tool.requires_env?.length ? (
              <Badge variant="warning" className="text-xs">
                {"需密钥"}
              </Badge>
            ) : null}
            {missingContract ? (
              <Badge variant="destructive" className="text-xs">
                {"未记录返回契约"}
              </Badge>
            ) : null}
          </div>
        </div>
        {tool.description ? (
          <p className="text-xs text-muted-foreground">{tool.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-1">{returnKindHint(tool.return_kind)}</p>
        {tool.return_text_hint ? (
          <p className="text-xs text-muted-foreground mt-1">{tool.return_text_hint}</p>
        ) : null}

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-muted-foreground">
            {"参数 schema"}
          </summary>
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </details>

        {tool.return_schema ? (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-muted-foreground">
              {"成功返回 schema"}
            </summary>
            <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(tool.return_schema, null, 2)}
            </pre>
          </details>
        ) : null}

        {exampleText ? (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-muted-foreground flex items-center gap-2">
              <span>{"保真示例（成功）"}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  void copyText(exampleText, "成功返回示例");
                }}
              >
                {"复制"}
              </Button>
            </summary>
            <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
              {exampleText}
            </pre>
          </details>
        ) : null}

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-muted-foreground">{"错误返回"}</summary>
          <p className="text-xs text-muted-foreground mt-1">{"所有工具失败时统一返回 JSON："}</p>
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.error_schema, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground mt-2">{"示例："}</p>
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.error_example, null, 2)}
          </pre>
        </details>

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-muted-foreground">
            {"完整 OpenAI 定义"}
          </summary>
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.definition, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function ToolsPage() {
  const data = Route.useLoaderData();
  const [page, setPage] = useState(1);
  const tools = useMemo(() => data.tools ?? [], [data.tools]);
  const defaultToolSets = data.default_toolsets ?? [];
  const toolSets = sortToolSets(data.toolsets ?? []);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const groupedNames = useMemo(() => {
    const names = new Set<string>();
    for (const ts of toolSets) {
      for (const name of ts.tools) names.add(name);
    }
    return names;
  }, [toolSets]);

  const ungroupedTools = useMemo(
    () => tools.filter((t) => !groupedNames.has(t.name)),
    [tools, groupedNames],
  );

  const pagedTools = useMemo(() => {
    const start = (page - 1) * TOOLS_PAGE_SIZE;
    return tools.slice(start, start + TOOLS_PAGE_SIZE);
  }, [tools, page]);

  const pagedUngroupedTools = useMemo(() => {
    const start = (page - 1) * TOOLS_PAGE_SIZE;
    return ungroupedTools.slice(start, start + TOOLS_PAGE_SIZE);
  }, [ungroupedTools, page]);

  if (toolSets.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">{"🔧 工具"}</h2>
        <p className="text-sm text-muted-foreground mb-4">{"已注册的工具列表。"}</p>
        <DefaultToolSetsSection names={defaultToolSets} />
        <div className="space-y-3">
          {pagedTools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
        <MemoryListPagination
          total={tools.length}
          pageSize={TOOLS_PAGE_SIZE}
          currentPage={page}
          onPageChange={setPage}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{"🔧 工具"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"已注册的工具列表（按 ToolSet 分组）。"}
      </p>
      <DefaultToolSetsSection names={defaultToolSets} />

      <div className="space-y-4">
        {toolSets.map((ts) => {
          const groupedTools = ts.tools
            .map((name) => toolByName.get(name))
            .filter((t): t is ToolsStatusToolItem => t !== undefined);
          return (
            <details key={ts.name} className="group">
              <summary className="cursor-pointer font-bold list-none flex items-baseline gap-2">
                <span className="select-none">📦 {ts.name}</span>
                <Badge variant="ghost" className="text-xs">
                  {groupedTools.length}
                </Badge>
                {ts.description ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {ts.description}
                  </span>
                ) : null}
              </summary>
              {groupedTools.length > 0 ? (
                <div className="space-y-2 mt-2 ml-4">
                  {groupedTools.map((tool) => (
                    <ToolCard key={tool.name} tool={tool} />
                  ))}
                </div>
              ) : null}
            </details>
          );
        })}

        {ungroupedTools.length > 0 ? (
          <>
            <h3 className="text-sm font-bold mt-4 mb-2">{"🔧 未分组工具"}</h3>
            <div className="space-y-3">
              {pagedUngroupedTools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
            <MemoryListPagination
              total={ungroupedTools.length}
              pageSize={TOOLS_PAGE_SIZE}
              currentPage={page}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import type {
  ToolsStatusResponse,
  ToolsStatusToolItem,
} from "@freeanima/features/habitat/protocol/habitat-contract/api/response-types.ts";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { getToolsStatus } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import {
  fetchHabitatConfigSection,
  replaceHabitatConfigSection,
} from "@freeanima/client/portal-sdk/habitat-config-api";

type ToolSetVisibility = "hidden" | "searchable" | "catalog";
type ToolsLoaderData = ToolsStatusResponse;
type ToolSetRow = ToolsLoaderData["toolsets"][number];

const EMPTY_LOADER_DATA: ToolsLoaderData = { default_toolsets: [], tools: [], toolsets: [] };
const TOOLS_PAGE_SIZE = 20;
const LONG_STALE_MS = 5 * 60_000;

const VISIBILITY_ORDER: ToolSetVisibility[] = ["catalog", "searchable", "hidden"];

const STATIC_TOOLSET_ORDER = ["toolset", "memory"] as const;

const selectClassName =
  "border-input flex h-8 min-w-0 rounded-md border bg-transparent px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function toolSetSortKey(name: string): [number, string] {
  const idx = STATIC_TOOLSET_ORDER.indexOf(name as (typeof STATIC_TOOLSET_ORDER)[number]);
  if (idx >= 0) return [idx, name];
  return [STATIC_TOOLSET_ORDER.length, name];
}

export function sortToolSets(toolSets: ToolSetRow[]): ToolSetRow[] {
  return toolSets.toSorted((a, b) => {
    const ka = toolSetSortKey(a.name);
    const kb = toolSetSortKey(b.name);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1].localeCompare(kb[1]);
  });
}

export function groupToolSetsByVisibility(
  toolSets: ToolSetRow[],
): Array<{ visibility: ToolSetVisibility; label: string; toolsets: ToolSetRow[] }> {
  const byVis = new Map<ToolSetVisibility, ToolSetRow[]>();
  for (const v of VISIBILITY_ORDER) byVis.set(v, []);
  for (const ts of sortToolSets(toolSets)) {
    const key =
      ts.visibility === "hidden" || ts.visibility === "searchable" || ts.visibility === "catalog"
        ? ts.visibility
        : "catalog";
    const list = byVis.get(key);
    if (!list) continue;
    list.push(ts);
  }
  return VISIBILITY_ORDER.map((visibility) => ({
    visibility,
    label: visibilityLabel(visibility),
    toolsets: byVis.get(visibility) ?? [],
  })).filter((g) => g.toolsets.length > 0);
}

export function visibilityLabel(visibility: ToolSetVisibility): string {
  switch (visibility) {
    case "catalog":
      return "进目录";
    case "searchable":
      return "可搜索";
    case "hidden":
      return "仅按名";
    default: {
      const _exhaustive: never = visibility;
      return String(_exhaustive);
    }
  }
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

function readVisibilityMap(value: unknown): Record<string, ToolSetVisibility> {
  const out: Record<string, ToolSetVisibility> = {};
  if (value == null || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === "hidden" || raw === "searchable" || raw === "catalog") out[key] = raw;
  }
  return out;
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
                onClick={(e: MouseEvent) => {
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

function ToolSetVisibilitySelect({
  toolSet,
  disabled,
  onChange,
}: {
  toolSet: ToolSetRow;
  disabled?: boolean;
  onChange: (next: ToolSetVisibility | "reset") => void;
}) {
  return (
    <select
      className={selectClassName}
      disabled={disabled}
      value={toolSet.visibility}
      aria-label={`${toolSet.name} 可见性`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const v = e.target.value;
        if (v === "reset") onChange("reset");
        else if (v === "hidden" || v === "searchable" || v === "catalog") onChange(v);
      }}
    >
      <option value="catalog">{"进目录"}</option>
      <option value="searchable">{"可搜索"}</option>
      <option value="hidden">{"仅按名"}</option>
      {toolSet.visibility_source === "override" ? (
        <option value="reset">{"恢复注册默认"}</option>
      ) : null}
    </select>
  );
}

function ToolsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const tools = useMemo(() => data.tools ?? [], [data.tools]);
  const defaultToolSets = data.default_toolsets ?? [];
  const visibilityGroups = useMemo(
    () => groupToolSetsByVisibility(data.toolsets ?? []),
    [data.toolsets],
  );
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const groupedNames = useMemo(() => {
    const names = new Set<string>();
    for (const g of visibilityGroups) {
      for (const ts of g.toolsets) {
        for (const name of ts.tools) names.add(name);
      }
    }
    return names;
  }, [visibilityGroups]);

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

  const applyVisibility = useCallback(
    async (name: string, next: ToolSetVisibility | "reset") => {
      setSavingName(name);
      setSaveError("");
      try {
        const section = await fetchHabitatConfigSection("toolset_visibility");
        const map = readVisibilityMap(section);
        if (next === "reset") delete map[name];
        else map[name] = next;
        await replaceHabitatConfigSection("toolset_visibility", map);
        await router.invalidate();
      } catch (e) {
        logCaughtError("tools/applyVisibility", e);
        setSaveError(e instanceof Error ? e.message : String(e));
      } finally {
        setSavingName(null);
      }
    },
    [router],
  );

  if (visibilityGroups.length === 0) {
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
        {"已注册的工具列表（按可见性分组）。可见性影响系统提示目录与 toolset_search。"}
      </p>
      {saveError ? <p className="text-sm text-destructive mb-3">{saveError}</p> : null}
      <DefaultToolSetsSection names={defaultToolSets} />

      <div className="space-y-6">
        {visibilityGroups.map((group) => (
          <section key={group.visibility} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <Badge variant="secondary" className="text-xs font-mono">
                {group.visibility}
              </Badge>
              <Badge variant="ghost" className="text-xs">
                {group.toolsets.length}
              </Badge>
            </div>
            {group.toolsets.map((ts) => {
              const groupedTools = ts.tools
                .map((name) => toolByName.get(name))
                .filter((t): t is ToolsStatusToolItem => t !== undefined);
              return (
                <details key={ts.name} className="group">
                  <summary className="cursor-pointer font-bold list-none flex flex-wrap items-center gap-2">
                    <span className="select-none font-mono">📦 {ts.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {visibilityLabel(ts.visibility)}
                    </Badge>
                    {ts.visibility_source === "override" ? (
                      <Badge variant="warning" className="text-xs">
                        {"覆盖"}
                      </Badge>
                    ) : null}
                    <Badge variant="ghost" className="text-xs">
                      {groupedTools.length}
                    </Badge>
                    <ToolSetVisibilitySelect
                      toolSet={ts}
                      disabled={savingName === ts.name}
                      onChange={(next) => void applyVisibility(ts.name, next)}
                    />
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
          </section>
        ))}

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

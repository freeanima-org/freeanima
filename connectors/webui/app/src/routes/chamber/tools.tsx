import { createFileRoute } from "@tanstack/react-router";
import { getToolsStatus } from "@/lib/api.ts";

type ToolRow = {
  name: string;
  description?: string;
  requires_env?: unknown;
  parameters?: unknown;
};

type ToolSetRow = {
  name: string;
  description: string;
  tools: string[];
};

type ToolsLoaderData = {
  tools: ToolRow[];
  tool_sets: ToolSetRow[];
};

const EMPTY_LOADER_DATA: ToolsLoaderData = { tools: [], tool_sets: [] };

/** 静态 ToolSet 展示顺序；未列出的静态集按名称排序，动态集 mcp_* → acp_* */
const STATIC_TOOLSET_ORDER = [
  "tools",
  "file",
  "terminal",
  "browser",
  "web",
  "code",
  "skills",
  "credentials",
  "tasks",
  "cron",
  "clarify",
  "fridge",
  "memory",
  "self",
  "email",
] as const;

function toolSetSortKey(name: string): [number, number, string] {
  if (name.startsWith("mcp_")) return [2, 0, name];
  if (name.startsWith("acp_")) return [3, 0, name];
  const idx = STATIC_TOOLSET_ORDER.indexOf(name as (typeof STATIC_TOOLSET_ORDER)[number]);
  if (idx >= 0) return [0, idx, name];
  return [1, 0, name];
}

function sortToolSets(toolSets: ToolSetRow[]): ToolSetRow[] {
  return toolSets.toSorted((a, b) => {
    const ka = toolSetSortKey(a.name);
    const kb = toolSetSortKey(b.name);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
  });
}

export const Route = createFileRoute("/chamber/tools")({
  loader: () => getToolsStatus().catch(() => EMPTY_LOADER_DATA) as Promise<ToolsLoaderData>,
  component: ToolsPage,
});

function ToolCard({ tool }: { tool: ToolRow }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-bold">{tool.name}</h3>
          {tool.requires_env ? <span className="badge badge-warning badge-xs">需密钥</span> : null}
        </div>
        {tool.description ? (
          <p className="text-xs text-base-content/60">{tool.description}</p>
        ) : null}
        {tool.parameters ? (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-base-content/50">参数</summary>
            <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
              {JSON.stringify(tool.parameters, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ToolsPage() {
  const data = Route.useLoaderData();
  const tools = data.tools ?? [];
  const toolSets = sortToolSets(data.tool_sets ?? []);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  if (!toolSets.length) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">🔧 工具</h2>
        <p className="text-sm text-base-content/60 mb-4">已注册的工具列表。</p>
        <div className="space-y-3">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </div>
    );
  }

  const groupedNames = new Set<string>();
  for (const ts of toolSets) {
    for (const name of ts.tools) groupedNames.add(name);
  }

  const ungroupedTools = tools.filter((t) => !groupedNames.has(t.name));

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🔧 工具</h2>
      <p className="text-sm text-base-content/60 mb-4">已注册的工具列表（按 ToolSet 分组）。</p>

      <div className="space-y-4">
        {toolSets.map((ts) => {
          const groupedTools = ts.tools
            .map((name) => toolByName.get(name))
            .filter((t): t is ToolRow => t !== undefined);
          if (!groupedTools.length) return null;
          return (
            <details key={ts.name} className="group">
              <summary className="cursor-pointer font-bold list-none flex items-baseline gap-2">
                <span className="select-none">📦 {ts.name}</span>
                <span className="badge badge-neutral badge-xs">{groupedTools.length}</span>
                {ts.description ? (
                  <span className="text-xs font-normal text-base-content/50">{ts.description}</span>
                ) : null}
              </summary>
              <div className="space-y-2 mt-2 ml-4">
                {groupedTools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </details>
          );
        })}

        {ungroupedTools.length > 0 ? (
          <>
            <h3 className="text-sm font-bold mt-4 mb-2">🔧 未分组工具</h3>
            <div className="space-y-3">
              {ungroupedTools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import type {
  ToolsStatusResponse,
  ToolsStatusToolItem,
} from "@freeanima/platform/connectors/webui/api";
import { getToolsStatus } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

type ToolsLoaderData = ToolsStatusResponse;

const EMPTY_LOADER_DATA: ToolsLoaderData = { default_tools: [], tools: [], toolsets: [] };

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
  return kind === "text" ? m.webui_chamber_tools_kind_text() : m.webui_chamber_tools_kind_json();
}

function returnKindHint(kind: ToolsStatusToolItem["return_kind"]): string {
  return kind === "text"
    ? m.webui_chamber_tools_return_text()
    : m.webui_chamber_tools_return_json();
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
    console.info(m.webui_common_copied({ label }));
  } catch {
    console.warn(m.webui_common_copy_failed({ label }));
  }
}

export const Route = createFileRoute("/chamber/tools")({
  loader: () =>
    getToolsStatus("default").catch(() => EMPTY_LOADER_DATA) as Promise<ToolsLoaderData>,
  component: ToolsPage,
});

function DefaultToolsSection({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="card bg-base-200 mb-4">
      <div className="card-body py-3 px-4 gap-2">
        <h3 className="text-sm font-semibold">{m.webui_chamber_tools_default_loaded()}</h3>
        <p className="text-xs text-base-content/60">
          {m.webui_chamber_tools_default_loaded_hint()}
        </p>
        <div className="flex flex-wrap gap-1">
          {names.map((name) => (
            <span key={name} className="badge badge-primary badge-sm font-mono">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolsStatusToolItem }) {
  const exampleText = formatReturnExample(tool);
  const missingContract = !tool.return_schema && !isDynamicRemoteTool(tool);

  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold break-all">{tool.name}</h3>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            <span
              className={`badge badge-xs ${tool.return_kind === "text" ? "badge-info" : "badge-neutral"}`}
            >
              {returnKindLabel(tool.return_kind)}
            </span>
            {tool.requires_env?.length ? (
              <span className="badge badge-warning badge-xs">
                {m.webui_chamber_tools_needs_secret()}
              </span>
            ) : null}
            {missingContract ? (
              <span className="badge badge-error badge-xs">
                {m.webui_chamber_tools_no_contract()}
              </span>
            ) : null}
          </div>
        </div>
        {tool.description ? (
          <p className="text-xs text-base-content/60">{tool.description}</p>
        ) : null}
        <p className="text-xs text-base-content/50 mt-1">{returnKindHint(tool.return_kind)}</p>
        {tool.return_text_hint ? (
          <p className="text-xs text-base-content/50 mt-1">{tool.return_text_hint}</p>
        ) : null}

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-base-content/50">
            {m.webui_chamber_tools_param_schema()}
          </summary>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </details>

        {tool.return_schema ? (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-base-content/50">
              {m.webui_chamber_tools_success_schema()}
            </summary>
            <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
              {JSON.stringify(tool.return_schema, null, 2)}
            </pre>
          </details>
        ) : null}

        {exampleText ? (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-base-content/50 flex items-center gap-2">
              <span>{m.webui_chamber_tools_fidelity_example()}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={(e) => {
                  e.preventDefault();
                  void copyText(exampleText, m.webui_chamber_tools_success_example());
                }}
              >
                {m.webui_common_copy()}
              </button>
            </summary>
            <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto whitespace-pre-wrap">
              {exampleText}
            </pre>
          </details>
        ) : null}

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-base-content/50">
            {m.webui_chamber_tools_error_return()}
          </summary>
          <p className="text-xs text-base-content/50 mt-1">
            {m.webui_chamber_tools_error_unified()}
          </p>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.error_schema, null, 2)}
          </pre>
          <p className="text-xs text-base-content/50 mt-2">{m.webui_chamber_tools_example()}</p>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.error_example, null, 2)}
          </pre>
        </details>

        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-base-content/50">
            {m.webui_chamber_tools_openai_def()}
          </summary>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.definition, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function ToolsPage() {
  const data = Route.useLoaderData();
  const tools = data.tools ?? [];
  const defaultTools = data.default_tools ?? [];
  const toolSets = sortToolSets(data.toolsets ?? []);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  if (!toolSets.length) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">{m.webui_chamber_nav_tools()}</h2>
        <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_tools_desc()}</p>
        <DefaultToolsSection names={defaultTools} />
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
      <h2 className="text-lg font-bold mb-4">{m.webui_chamber_nav_tools()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_tools_desc_grouped()}</p>
      <DefaultToolsSection names={defaultTools} />

      <div className="space-y-4">
        {toolSets.map((ts) => {
          const groupedTools = ts.tools
            .map((name) => toolByName.get(name))
            .filter((t): t is ToolsStatusToolItem => t !== undefined);
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
            <h3 className="text-sm font-bold mt-4 mb-2">{m.webui_chamber_tools_ungrouped()}</h3>
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

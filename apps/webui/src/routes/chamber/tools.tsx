import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/chamber/tools")({
  loader: () => trpc.status.tools.query().catch(() => ({ tools: [] as Record<string, unknown>[] })),
  component: ToolsPage,
});

function ToolsPage() {
  const data = Route.useLoaderData() as { tools?: Array<Record<string, unknown>> };
  const tools = (data.tools ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🔧 工具</h2>
      <p className="text-sm text-base-content/60 mb-4">已注册的工具列表。</p>
      <div className="space-y-3">
        {tools.map((tool) => (
          <div key={String(tool.name)} className="card bg-base-200">
            <div className="card-body py-3 px-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold">{String(tool.name)}</h3>
                {tool.requires_env ? (
                  <span className="badge badge-warning badge-xs">需密钥</span>
                ) : null}
              </div>
              {tool.description ? (
                <p className="text-xs text-base-content/60">{String(tool.description)}</p>
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
        ))}
      </div>
    </div>
  );
}

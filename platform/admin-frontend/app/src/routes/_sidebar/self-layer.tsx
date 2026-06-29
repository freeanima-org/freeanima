import { createFileRoute } from "@tanstack/react-router";
import type { SelfBlockDisplay } from "@freeanima/admin-contract/api";
import { getSelfBlocks } from "@admin/lib/api.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/self-layer")({
  loader: () =>
    getSelfBlocks().catch(catchWithFallback("self-layer/getSelfBlocks", { blocks: [] })),
  staleTime: 2 * 60_000,
  component: SelfLayerPage,
});

function SelfLayerPage() {
  const data = Route.useLoaderData() as { blocks?: SelfBlockDisplay[] };
  const blocks = data.blocks ?? [];

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.admin_nav_self_layer()}</h2>
      <p className="text-sm text-base-content/60 mb-4">
        {m.admin_self_layer_desc()} <code className="text-xs">update_self_block</code>
      </p>

      {blocks.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_self_layer_empty()}</div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => {
            const body = block.content.trim();
            return (
              <section key={block.block_key} className="card bg-base-200">
                <div className="card-body gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{block.heading}</h3>
                    <span className="badge badge-ghost badge-sm font-mono">{block.block_key}</span>
                    {block.locked ? (
                      <span className="badge badge-warning badge-sm">🔒 locked</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
                    <span>version {block.version}</span>
                    {block.updated_at ? (
                      <span>
                        {m.admin_self_layer_updated({
                          time: formatDisplayDateTime(block.updated_at),
                        })}
                      </span>
                    ) : null}
                    {block.updated_by ? <span>by {block.updated_by}</span> : null}
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${body ? "" : "text-base-content/50"}`}
                  >
                    {body || m.admin_self_layer_not_set()}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

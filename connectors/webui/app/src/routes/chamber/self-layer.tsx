import { createFileRoute } from "@tanstack/react-router";
import { getSelfBlocks } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

export const Route = createFileRoute("/chamber/self-layer")({
  loader: () => getSelfBlocks().catch(() => ({ blocks: [] })),
  component: SelfLayerPage,
});

type SelfBlockRow = {
  block_key: string;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created: string;
  updated: string;
};

function SelfLayerPage() {
  const data = Route.useLoaderData() as { blocks?: SelfBlockRow[] };
  const blocks = data.blocks ?? [];

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_self_layer()}</h2>
      <p className="text-sm text-base-content/60 mb-4">
        {m.webui_chamber_self_layer_desc()} <code className="text-xs">update_self_block</code>
      </p>

      {blocks.length === 0 ? (
        <div className="alert alert-info text-sm">{m.webui_chamber_self_layer_empty()}</div>
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
                    {block.updated ? (
                      <span>
                        {m.webui_chamber_self_layer_updated({
                          time: String(block.updated).slice(0, 19),
                        })}
                      </span>
                    ) : null}
                    {block.updated_by ? <span>by {block.updated_by}</span> : null}
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${body ? "" : "text-base-content/50"}`}
                  >
                    {body || m.webui_chamber_self_layer_not_set()}
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

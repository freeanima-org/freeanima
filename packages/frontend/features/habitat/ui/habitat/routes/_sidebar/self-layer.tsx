import { createFileRoute } from "@tanstack/react-router";
import type { SelfBlockDisplay } from "@freeanima/features/habitat/protocol/habitat-contract/self-block-display.ts";
import { Badge, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getSelfBlocks } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { catchWithFallback } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
      <h2 className="text-lg font-bold mb-1">{"🪞 自我层"}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {"PG self_blocks 五块只读展示；维护请用 self_update_block，或每周 Inbox 提议经伙伴确认。"}{" "}
        <code className="text-xs">update_self_block</code>
      </p>

      {blocks.length === 0 ? (
        <StatusAlert variant="info">{"暂无自我层数据（PG 不可用或未初始化）。"}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => {
            const body = block.content.trim();
            return (
              <Card key={block.block_key} className="bg-muted py-0">
                <CardContent className="gap-3 py-4 px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{block.heading}</h3>
                    <Badge variant="ghost" className="text-xs font-mono">
                      {block.block_key}
                    </Badge>
                    {block.locked ? (
                      <Badge variant="warning" className="text-xs">
                        🔒 locked
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>version {block.version}</span>
                    {block.updated_at ? (
                      <span>{`更新于 ${formatDisplayDateTime(block.updated_at)}`}</span>
                    ) : null}
                    {block.updated_by ? <span>by {block.updated_by}</span> : null}
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${body ? "" : "text-muted-foreground"}`}
                  >
                    {body || "（尚未设定）"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

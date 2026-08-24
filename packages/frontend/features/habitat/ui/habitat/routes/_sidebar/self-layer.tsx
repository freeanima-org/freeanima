import { createFileRoute } from "@tanstack/react-router";
import { RedirectToBedroom } from "@freeanima/features/habitat/ui/habitat/components/RedirectToBedroom.tsx";
import { useEffect, useState } from "react";
import type { SelfBlockDisplay } from "@freeanima/features/habitat/protocol/habitat-contract/self-block-display.ts";
import { Badge, Button, Card, CardContent, Spinner } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getSelfBlocks } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useBedroomAgentSubjectId } from "@freeanima/features/habitat/ui/habitat/lib/bedroom-agent.tsx";
import { useMemoryPipeline } from "@freeanima/features/habitat/ui/habitat/lib/use-memory-pipeline.ts";

export const Route = createFileRoute("/_sidebar/self-layer")({
  component: () => <RedirectToBedroom subpath="/self-layer" />,
});

export function SelfLayerPage() {
  const agentSubjectId = useBedroomAgentSubjectId();
  const [blocks, setBlocks] = useState<SelfBlockDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const { pipelineBusy, pipelineError, runningStepId, startStep } = useMemoryPipeline({
    logScope: "self-layer/refresh",
    onSettled: () => {
      setReloadToken((n) => n + 1);
    },
  });

  useEffect(() => {
    if (agentSubjectId == null) return () => {};
    let cancelled = false;
    setLoading(true);
    setLocalError("");
    void getSelfBlocks({ agent_subject_id: agentSubjectId })
      .then((data) => {
        if (cancelled) return;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- self.blocks 响应边界
        const payload = data as { blocks?: SelfBlockDisplay[] };
        setBlocks(payload.blocks ?? []);
      })
      .catch((e: unknown) => {
        logCaughtError("self-layer/getSelfBlocks", e);
        if (cancelled) return;
        setBlocks([]);
        setLocalError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentSubjectId, reloadToken]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-bold">{"🪞 自我层"}</h2>
          <p className="text-muted-foreground text-sm">
            {
              "entities 上 primary=self_block 五块只读展示；维护请用 self_update_block，或每周 Inbox 提议经伙伴确认。"
            }{" "}
            <code className="text-xs">update_self_block</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isDisabled={pipelineBusy}
            onClick={() => {
              setLocalError("");
              void startStep("self-layer-refresh");
            }}
          >
            {runningStepId === "self-layer-refresh" ? "刷新中…" : "运行自我层刷新"}
          </Button>
        </div>
      </div>

      {pipelineError || localError ? (
        <StatusAlert variant="error" className="mb-4">
          {pipelineError || localError}
        </StatusAlert>
      ) : null}

      {loading || agentSubjectId == null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {"加载自我层…"}
        </div>
      ) : blocks.length === 0 ? (
        <StatusAlert variant="info">{"暂无自我层数据（PG 不可用或未初始化）。"}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => {
            const body = block.content.trim();
            return (
              <Card key={block.block_key} className="bg-muted py-0">
                <CardContent className="gap-3 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{block.heading}</h3>
                    <Badge variant="ghost" className="font-mono text-xs">
                      {block.block_key}
                    </Badge>
                    {block.locked ? (
                      <Badge variant="warning" className="text-xs">
                        🔒 locked
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
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

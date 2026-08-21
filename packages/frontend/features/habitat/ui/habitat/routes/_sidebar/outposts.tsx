import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getOutpostsStatus } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/outposts")({
  loader: () => getOutpostsStatus().catch(catchWithFallback("habitat/getOutpostsStatus", null)),
  component: OutpostsPage,
});

type OutpostInstance = {
  app_id: string;
  app_slug: string;
  instance_id: string;
  instance_id_norm: string;
  platform: string | null;
  connected_at: string;
  last_heartbeat_at: string | null;
  http_url: string | null;
  tool_count: number;
  tools: string[];
};

type OutpostsStatus = {
  instance_count: number;
  tool_count: number;
  instances: OutpostInstance[];
};

function OutpostsPage() {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
  const initial = Route.useLoaderData() as OutpostsStatus | null;

  const [status, setStatus] = useState<OutpostsStatus | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initial ? "" : "加载失败");

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
      setStatus((await getOutpostsStatus()) as OutpostsStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/outposts", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{"Outposts"}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || "加载失败"}
        </StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{"Outposts"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {"Outposts connected to this Habitat that registered remote tools (read-only)."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? "刷新中…" : "刷新"}
        </Button>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["实例", status.instance_count],
            ["注册工具", status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label} {count}
          </Badge>
        ))}
      </div>

      {status.instances.length === 0 ? (
        <StatusAlert variant="info">
          {
            "No outpost instances connected. Start an outpost (Portal companion or standalone tool) to see it here."
          }
        </StatusAlert>
      ) : (
        <div className="space-y-4">
          {status.instances.map((inst) => (
            <Card key={`${inst.app_slug}:${inst.instance_id_norm}`} className="bg-muted py-0">
              <CardContent className="gap-3 py-4 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inst.app_id}</span>
                  <Badge variant="success" className="text-xs">
                    {"已连接"}
                  </Badge>
                  {inst.platform ? (
                    <Badge variant="outline" className="text-xs">
                      {inst.platform}
                    </Badge>
                  ) : null}
                  {inst.http_url ? (
                    <a
                      href={inst.http_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline text-xs"
                    >
                      {inst.http_url}
                    </a>
                  ) : null}
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{"应用 ID"}</dt>
                    <dd className="font-mono text-xs break-all">{inst.app_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{"实例 ID"}</dt>
                    <dd className="font-mono text-xs break-all">{inst.instance_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{"已连接"}</dt>
                    <dd>{formatDisplayDateTime(inst.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{"最近心跳"}</dt>
                    <dd>{formatDisplayDateTime(inst.last_heartbeat_at)}</dd>
                  </div>
                </dl>

                <p className="text-sm font-medium">{`${String(inst.tool_count)} 个工具`}</p>
                {inst.tools.length > 0 ? (
                  <ul className="text-xs font-mono space-y-1">
                    {inst.tools.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

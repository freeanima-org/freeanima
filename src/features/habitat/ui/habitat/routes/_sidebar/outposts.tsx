import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { getOutpostsStatus } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
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
  const initial = Route.useLoaderData() as OutpostsStatus | null;

  const [status, setStatus] = useState<OutpostsStatus | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initial ? "" : m.habitat_common_load_failed_short());

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
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
        <h2 className="text-lg font-bold">{m.habitat_nav_outposts()}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || m.habitat_common_load_failed_short()}
        </StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.habitat_nav_outposts()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.habitat_outposts_desc()}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? m.habitat_common_refreshing() : m.habitat_common_refresh()}
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
            [m.habitat_outposts_instances(), status.instance_count],
            [m.habitat_outposts_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label} {count}
          </Badge>
        ))}
      </div>

      {status.instances.length === 0 ? (
        <StatusAlert variant="info">{m.habitat_outposts_empty_hint()}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {status.instances.map((inst) => (
            <Card key={`${inst.app_slug}:${inst.instance_id_norm}`} className="bg-muted py-0">
              <CardContent className="gap-3 py-4 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inst.app_id}</span>
                  <Badge variant="success" className="text-xs">
                    {m.habitat_common_connected()}
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
                    <dt className="text-muted-foreground">{m.habitat_outposts_app_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.app_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.habitat_outposts_instance_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.instance_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.habitat_outposts_connected_at()}</dt>
                    <dd>{formatDisplayDateTime(inst.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.habitat_outposts_last_heartbeat()}</dt>
                    <dd>{formatDisplayDateTime(inst.last_heartbeat_at)}</dd>
                  </div>
                </dl>

                <p className="text-sm font-medium">
                  {m.habitat_outposts_tools_count({ count: String(inst.tool_count) })}
                </p>
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

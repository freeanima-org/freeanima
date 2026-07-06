import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getSatellitesStatus } from "@console/lib/api.ts";
import { formatDisplayDateTime } from "@console/lib/format-datetime.ts";
import { m } from "@console/lib/i18n.ts";
import { catchWithFallback, logCaughtError } from "@console/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/satellites")({
  loader: () =>
    getSatellitesStatus().catch(catchWithFallback("src/satellites/getSatellitesStatus", null)),
  component: SatellitesPage,
});

type SatelliteInstance = {
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

type SatellitesStatus = {
  instance_count: number;
  tool_count: number;
  instances: SatelliteInstance[];
};

function SatellitesPage() {
  const initial = Route.useLoaderData() as SatellitesStatus | null;

  const [status, setStatus] = useState<SatellitesStatus | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initial ? "" : m.console_common_load_failed_short());

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      setStatus((await getSatellitesStatus()) as SatellitesStatus);
    } catch (e) {
      logCaughtError("routes/_sidebar/satellites", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.console_nav_satellites()}</h2>
        <StatusAlert variant="error" className="mt-4">
          {error || m.console_common_load_failed_short()}
        </StatusAlert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.console_nav_satellites()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.console_satellites_desc()}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? m.console_common_refreshing() : m.console_common_refresh()}
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
            [m.console_satellites_instances(), status.instance_count],
            [m.console_satellites_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label} {count}
          </Badge>
        ))}
      </div>

      {status.instances.length === 0 ? (
        <StatusAlert variant="info">{m.console_satellites_empty_hint()}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {status.instances.map((inst) => (
            <Card key={`${inst.app_slug}:${inst.instance_id_norm}`} className="bg-muted py-0">
              <CardContent className="gap-3 py-4 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inst.app_id}</span>
                  <Badge variant="success" className="text-xs">
                    {m.console_common_connected()}
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
                    <dt className="text-muted-foreground">{m.console_satellites_app_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.app_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.console_satellites_instance_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.instance_id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.console_satellites_connected_at()}</dt>
                    <dd>{formatDisplayDateTime(inst.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {m.console_satellites_last_heartbeat()}
                    </dt>
                    <dd>{formatDisplayDateTime(inst.last_heartbeat_at)}</dd>
                  </div>
                </dl>

                <p className="text-sm font-medium">
                  {m.console_satellites_tools_count({ count: String(inst.tool_count) })}
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

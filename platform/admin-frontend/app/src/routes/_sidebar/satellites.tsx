import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getSatellitesStatus } from "@admin/lib/api.ts";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/satellites")({
  loader: () =>
    getSatellitesStatus().catch(catchWithFallback("satellites/getSatellitesStatus", null)),
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
  const [error, setError] = useState(initial ? "" : m.admin_common_load_failed_short());

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
        <h2 className="text-lg font-bold">{m.admin_nav_satellites()}</h2>
        <div className="alert alert-error text-sm mt-4">
          {error || m.admin_common_load_failed_short()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.admin_nav_satellites()}</h2>
          <p className="text-sm text-base-content/60 mt-1">{m.admin_satellites_desc()}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? m.admin_common_refreshing() : m.admin_common_refresh()}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            [m.admin_satellites_instances(), status.instance_count],
            [m.admin_satellites_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <span key={label} className="badge badge-outline">
            {label} {count}
          </span>
        ))}
      </div>

      {status.instances.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_satellites_empty_hint()}</div>
      ) : (
        <div className="space-y-4">
          {status.instances.map((inst) => (
            <div key={`${inst.app_slug}:${inst.instance_id_norm}`} className="card bg-base-200">
              <div className="card-body gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inst.app_id}</span>
                  <span className="badge badge-sm badge-success">{m.admin_common_connected()}</span>
                  {inst.platform ? (
                    <span className="badge badge-sm badge-outline">{inst.platform}</span>
                  ) : null}
                  {inst.http_url ? (
                    <a
                      href={inst.http_url}
                      target="_blank"
                      rel="noreferrer"
                      className="link link-primary text-xs"
                    >
                      {inst.http_url}
                    </a>
                  ) : null}
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-base-content/60">{m.admin_satellites_app_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.app_id}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{m.admin_satellites_instance_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.instance_id}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{m.admin_satellites_connected_at()}</dt>
                    <dd>{formatDisplayDateTime(inst.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">{m.admin_satellites_last_heartbeat()}</dt>
                    <dd>{formatDisplayDateTime(inst.last_heartbeat_at)}</dd>
                  </div>
                </dl>

                <p className="text-sm font-medium">
                  {m.admin_satellites_tools_count({ count: String(inst.tool_count) })}
                </p>
                {inst.tools.length > 0 ? (
                  <ul className="text-xs font-mono space-y-1">
                    {inst.tools.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

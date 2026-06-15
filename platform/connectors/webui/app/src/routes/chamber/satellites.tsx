import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getSatellitesStatus } from "@/lib/api.ts";
import { formatDisplayDateTime } from "@/lib/format-datetime.ts";
import { m } from "@/lib/i18n.ts";

export const Route = createFileRoute("/chamber/satellites")({
  loader: () => getSatellitesStatus().catch(() => null),
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
  const [error, setError] = useState(initial ? "" : m.webui_common_load_failed_short());

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      setStatus((await getSatellitesStatus()) as SatellitesStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (!status) {
    return (
      <div>
        <h2 className="text-lg font-bold">{m.webui_chamber_nav_satellites()}</h2>
        <div className="alert alert-error text-sm mt-4">
          {error || m.webui_common_load_failed_short()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.webui_chamber_nav_satellites()}</h2>
          <p className="text-sm text-base-content/60 mt-1">{m.webui_chamber_satellites_desc()}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? m.webui_common_refreshing() : m.webui_common_refresh()}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            [m.webui_chamber_satellites_instances(), status.instance_count],
            [m.webui_chamber_satellites_registered_tools(), status.tool_count],
          ] as const
        ).map(([label, count]) => (
          <span key={label} className="badge badge-outline">
            {label} {count}
          </span>
        ))}
      </div>

      {status.instances.length === 0 ? (
        <div className="alert alert-info text-sm">{m.webui_chamber_satellites_empty_hint()}</div>
      ) : (
        <div className="space-y-4">
          {status.instances.map((inst) => (
            <div key={`${inst.app_slug}:${inst.instance_id_norm}`} className="card bg-base-200">
              <div className="card-body gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{inst.app_id}</span>
                  <span className="badge badge-sm badge-success">{m.webui_common_connected()}</span>
                  {inst.platform ? (
                    <span className="badge badge-sm badge-outline">{inst.platform}</span>
                  ) : null}
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-base-content/60">{m.webui_chamber_satellites_app_id()}</dt>
                    <dd className="font-mono text-xs break-all">{inst.app_id}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">
                      {m.webui_chamber_satellites_instance_id()}
                    </dt>
                    <dd className="font-mono text-xs break-all">{inst.instance_id}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">
                      {m.webui_chamber_satellites_connected_at()}
                    </dt>
                    <dd>{formatDisplayDateTime(inst.connected_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">
                      {m.webui_chamber_satellites_last_heartbeat()}
                    </dt>
                    <dd>{formatDisplayDateTime(inst.last_heartbeat_at)}</dd>
                  </div>
                </dl>

                <p className="text-sm font-medium">
                  {m.webui_chamber_satellites_tools_count({ count: String(inst.tool_count) })}
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

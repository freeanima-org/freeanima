import { Link } from "@tanstack/react-router";
import { m } from "@/lib/i18n.ts";

export type FridgeMagnetItem = {
  key: string;
  value: string;
  module: "session" | "tasks" | "other";
  session_id?: string;
  label?: string;
  ttl_seconds: number | null;
};

export function formatFridgeTtl(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 0) return m.webui_chamber_fridge_expiry_none();
  if (seconds < 60) return m.webui_chamber_fridge_expiry_seconds({ seconds: String(seconds) });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0)
    return m.webui_chamber_fridge_expiry_hours({ hours: String(hours), minutes: String(minutes) });
  return m.webui_chamber_fridge_expiry_minutes({ minutes: String(minutes) });
}

type FridgeMagnetDetailListProps = {
  magnets: FridgeMagnetItem[];
  redisConfigured: boolean;
};

export function FridgeMagnetDetailList({ magnets, redisConfigured }: FridgeMagnetDetailListProps) {
  if (!redisConfigured) {
    return <div className="alert alert-warning text-sm">{m.webui_chamber_fridge_redis_down()}</div>;
  }

  if (magnets.length === 0) {
    return <div className="alert alert-info text-sm">{m.webui_chamber_fridge_empty()}</div>;
  }

  return (
    <div className="space-y-3">
      {magnets.map((magnet) => (
        <section key={magnet.key} className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-ghost badge-sm font-mono">{magnet.key}</span>
              {magnet.module === "tasks" ? (
                <span className="badge badge-info badge-sm">
                  {m.webui_chamber_fridge_badge_task()}
                </span>
              ) : magnet.module === "session" ? (
                <span className="badge badge-primary badge-sm">
                  {m.webui_chamber_fridge_badge_session()}
                </span>
              ) : null}
              <span className="text-xs text-base-content/60">
                {formatFridgeTtl(magnet.ttl_seconds)}
              </span>
            </div>
            {magnet.session_id ? (
              <div className="text-xs">
                {m.webui_common_session_label()}{" "}
                <Link
                  to="/chamber/sessions/$sessionId"
                  params={{ sessionId: magnet.session_id }}
                  className="link link-primary font-mono"
                >
                  {magnet.session_id}
                </Link>
              </div>
            ) : null}
            <p className="text-sm whitespace-pre-wrap">{magnet.value}</p>
          </div>
        </section>
      ))}
    </div>
  );
}

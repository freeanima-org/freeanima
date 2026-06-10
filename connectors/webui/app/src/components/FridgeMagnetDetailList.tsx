import { Link } from "@tanstack/react-router";

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
  if (seconds < 0) return "无过期";
  if (seconds < 60) return `剩余 ${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `剩余 ${hours}h ${minutes}m`;
  return `剩余 ${minutes}m`;
}

type FridgeMagnetDetailListProps = {
  magnets: FridgeMagnetItem[];
  redisConfigured: boolean;
};

export function FridgeMagnetDetailList({ magnets, redisConfigured }: FridgeMagnetDetailListProps) {
  if (!redisConfigured) {
    return (
      <div className="alert alert-warning text-sm">
        Redis 未配置或不可用，冰箱贴功能已静默降级。
      </div>
    );
  }

  if (magnets.length === 0) {
    return <div className="alert alert-info text-sm">当前无冰箱贴便签。</div>;
  }

  return (
    <div className="space-y-3">
      {magnets.map((magnet) => (
        <section key={magnet.key} className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-ghost badge-sm font-mono">{magnet.key}</span>
              {magnet.module === "tasks" ? (
                <span className="badge badge-info badge-sm">待办摘要</span>
              ) : magnet.module === "session" ? (
                <span className="badge badge-primary badge-sm">会话便签</span>
              ) : null}
              <span className="text-xs text-base-content/60">
                {formatFridgeTtl(magnet.ttl_seconds)}
              </span>
            </div>
            {magnet.session_id ? (
              <div className="text-xs">
                会话{" "}
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

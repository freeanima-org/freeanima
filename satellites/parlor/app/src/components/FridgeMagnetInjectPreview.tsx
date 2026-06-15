import { m } from "@/lib/i18n.ts";

type FridgeMagnetInjectPreviewProps = {
  injectText: string;
  magnetCount: number;
  redisConfigured: boolean;
  loading?: boolean;
  onRefresh?: () => void;
};

export function FridgeMagnetInjectPreview({
  injectText,
  magnetCount,
  redisConfigured,
  loading = false,
  onRefresh,
}: FridgeMagnetInjectPreviewProps) {
  const hasMagnets = magnetCount > 0;

  return (
    <details className="group border-t border-base-300 bg-base-100">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs text-base-content/70 hover:bg-base-200">
        <span className="group-open:rotate-90 transition-transform">▶</span>
        <span>{m.webui_chamber_nav_fridge()}</span>
        {hasMagnets ? <span className="badge badge-ghost badge-xs">{magnetCount}</span> : null}
        {onRefresh ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onRefresh();
            }}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              m.webui_common_refresh()
            )}
          </button>
        ) : null}
      </summary>
      <div className="px-4 pb-3">
        {!redisConfigured ? (
          <p className="text-xs text-warning">{m.webui_chamber_fridge_redis_unavailable()}</p>
        ) : !hasMagnets ? (
          <p className="text-xs text-base-content/50">{m.webui_chamber_fridge_no_notes()}</p>
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap text-base-content/80 bg-base-200 rounded-lg p-2 overflow-x-auto">
            {injectText.trimEnd()}
          </pre>
        )}
      </div>
    </details>
  );
}

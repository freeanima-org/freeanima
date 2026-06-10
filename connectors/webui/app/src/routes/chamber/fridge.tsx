import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FridgeMagnetDetailList } from "@/components/FridgeMagnetDetailList.tsx";
import { m } from "@/lib/i18n.ts";
import { getFridgeMagnets } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/fridge")({
  loader: () =>
    getFridgeMagnets().catch(() => ({ redis_configured: false, magnets: [], inject_text: "" })),
  component: FridgePage,
});

type FridgePageData = Awaited<ReturnType<typeof getFridgeMagnets>>;

function FridgePage() {
  const initial = Route.useLoaderData() as FridgePageData;
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await getFridgeMagnets());
    } catch {
      setData({ redis_configured: false, magnets: [], inject_text: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-bold">{m.webui_chamber_nav_fridge()}</h2>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            m.webui_common_refresh()
          )}
        </button>
      </div>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_fridge_desc()}</p>
      <FridgeMagnetDetailList magnets={data.magnets} redisConfigured={data.redis_configured} />
    </div>
  );
}

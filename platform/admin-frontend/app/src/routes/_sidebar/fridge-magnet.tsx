import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Spinner } from "@freeanima/ui-kit";
import { FridgeMagnetDetailList } from "@admin/components/FridgeMagnetDetailList.tsx";
import { m } from "@admin/lib/i18n.ts";
import { getFridgeMagnets } from "@admin/lib/api.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/fridge-magnet")({
  loader: () =>
    getFridgeMagnets().catch(
      catchWithFallback("fridge-magnet/getFridgeMagnets", {
        redis_configured: false,
        magnets: [],
        inject_text: "",
      }),
    ),
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
    } catch (err) {
      logCaughtError("fridge-magnet/refresh", err);
      setData({ redis_configured: false, magnets: [], inject_text: "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-bold">{m.admin_nav_fridge()}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? <Spinner /> : m.admin_common_refresh()}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{m.admin_fridge_desc()}</p>
      <FridgeMagnetDetailList magnets={data.magnets} redisConfigured={data.redis_configured} />
    </div>
  );
}

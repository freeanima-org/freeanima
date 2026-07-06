import { Card, CardContent } from "@freeanima/ui-kit";
import { useCompanionStore } from "@/stores/companion.ts";

export function GeneralTab() {
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
        <CardContent className="flex flex-col gap-1 px-4 py-3 text-xs text-muted-foreground">
          <p>
            实例 ID：<span className="text-foreground">{instanceId || "—"}</span>
          </p>
          <p>
            SAP：
            <span
              className={
                sapConnected
                  ? "text-green-700 dark:text-green-300"
                  : "text-yellow-700 dark:text-yellow-300"
              }
            >
              {sapConnected ? "已连接" : "未连接"}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

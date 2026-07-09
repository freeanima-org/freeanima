import { useEffect, useState } from "react";
import { Card, CardContent } from "@freeanima/frontend/ui-kit";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import type { CompanionSettingsApi } from "@freeanima/frontend/shell-sdk/settings";
import { useCompanionStore } from "@freeanima/satellites/companion/spa/stores/companion.ts";

type Props = {
  companionApi?: CompanionSettingsApi;
};

export function GeneralTab({ companionApi }: Props) {
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);
  const [companionVisible, setCompanionVisible] = useState(true);
  const [visibilityReady, setVisibilityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const visible = await companionApi?.getCompanionVisible?.();
        if (!cancelled && typeof visible === "boolean") {
          setCompanionVisible(visible);
        }
      } finally {
        if (!cancelled) setVisibilityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companionApi]);

  const onCompanionVisibleChange = (checked: boolean) => {
    setCompanionVisible(checked);
    void companionApi?.setCompanionVisible?.(checked);
  };

  return (
    <div className="flex flex-col gap-4">
      <FormToggle
        label="显示伴侣"
        hint="关闭后桌面伴侣窗口将隐藏；可在本页重新开启"
        checked={companionVisible}
        disabled={!visibilityReady || !companionApi}
        onChange={onCompanionVisibleChange}
      />

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

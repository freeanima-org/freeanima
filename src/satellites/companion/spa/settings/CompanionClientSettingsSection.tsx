import { useEffect, useState } from "react";
import { Card, CardContent } from "@freeanima/frontend/ui-kit";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";
import { fetchSidecarRuntimeFields } from "@freeanima/satellites/companion/spa/lib/api.ts";
import type { CompanionShellSettings } from "./companion-shell-settings.ts";

export type { CompanionShellSettings };

export default function CompanionClientSettingsSection({ store }: SettingsPanelProps) {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [sapConnected, setSapConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubConfig: (() => void) | undefined;

    const refresh = async (): Promise<void> => {
      try {
        if (store) {
          const raw = (await store.load()) as CompanionShellSettings;
          if (!cancelled && typeof raw?.visible === "boolean") {
            setVisible(raw.visible);
          }
        }
        const runtime = await fetchSidecarRuntimeFields();
        if (!cancelled) {
          setInstanceId(runtime.instance_id);
          setSapConnected(runtime.sap_connected);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void refresh();
    const shell = window.satelliteShell;
    if (shell?.listenConfigChanged) {
      unsubConfig = shell.listenConfigChanged(() => {
        void refresh();
      });
    }

    return () => {
      cancelled = true;
      unsubConfig?.();
    };
  }, [store]);

  const onVisibleChange = (checked: boolean) => {
    setVisible(checked);
    if (!store) return;
    void store.save({ visible: checked });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormToggle
        label="显示伴侣"
        hint="关闭后桌面伴侣窗口将隐藏；可在本页重新开启"
        checked={visible}
        disabled={!ready || !store}
        onChange={onVisibleChange}
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

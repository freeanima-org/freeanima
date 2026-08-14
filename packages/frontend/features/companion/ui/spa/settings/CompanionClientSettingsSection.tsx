import { useEffect, useState } from "react";
import { Button, Card, CardContent } from "@freeanima/ui-kit";
import { FormToggle } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";
import { fetchCompanionRuntimeFields } from "@freeanima/features/companion/ui/spa/lib/api.ts";
import type { CompanionShellSettings } from "./companion-shell-settings.ts";

export type { CompanionShellSettings };

const TEST_BUBBLE_TEXT = "这是一条测试气泡。点击气泡可切换到下一条或关闭。";

export default function CompanionClientSettingsSection({ store }: SettingsPanelProps) {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [sapConnected, setSapConnected] = useState(false);
  const [testingBubble, setTestingBubble] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

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
        const runtime = await fetchCompanionRuntimeFields();
        if (!cancelled) {
          setInstanceId(runtime.instance_id);
          setSapConnected(runtime.remote_tools_connected);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void refresh();
    const shell = window.portalShell;
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

  const onTestBubble = async (): Promise<void> => {
    const shell = window.portalShell;
    if (!shell?.enqueueCompanionBubble) {
      setTestError("当前环境不支持向伴侣窗推送气泡");
      return;
    }
    setTestingBubble(true);
    setTestError(null);
    try {
      if (!visible) {
        setVisible(true);
        await store?.save({ visible: true });
        await shell.setCompanionVisible?.(true);
      }
      await shell.enqueueCompanionBubble(TEST_BUBBLE_TEXT);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestingBubble(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormToggle
        label="显示伴侣"
        hint="关闭后伴侣窗口关闭并离线（远程工具断开）；重新开启后重建窗口并连接"
        checked={visible}
        disabled={!ready || !store}
        onChange={onVisibleChange}
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          isDisabled={!ready || testingBubble || !window.portalShell?.enqueueCompanionBubble}
          onClick={() => void onTestBubble()}
        >
          {testingBubble ? "发送中…" : "测试文字气泡"}
        </Button>
        <p className="text-xs text-muted-foreground">
          在桌面伴侣角色上方显示一条测试气泡（需伴侣窗口已显示）
        </p>
        {testError ? <p className="text-xs text-destructive">{testError}</p> : null}
      </div>

      <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
        <CardContent className="flex flex-col gap-1 px-4 py-3 text-xs text-muted-foreground">
          <p>
            实例 ID：<span className="text-foreground">{instanceId || "—"}</span>
          </p>
          <p>
            远程工具：
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

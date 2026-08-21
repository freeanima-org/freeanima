import { useEffect, useState } from "react";
import { FormToggle } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";

export default function PomodoroFloatClientSettingsSection(_props: SettingsPanelProps) {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubConfig: (() => void) | undefined;

    const refresh = async (): Promise<void> => {
      const shell = window.portalShell;
      if (!shell?.getPomodoroFloatVisible || !shell.setPomodoroFloatVisible) {
        if (!cancelled) {
          setSupported(false);
          setReady(true);
        }
        return;
      }
      try {
        const next = await shell.getPomodoroFloatVisible();
        if (!cancelled) {
          setSupported(true);
          setVisible(next);
        }
      } catch {
        if (!cancelled) setSupported(false);
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
  }, []);

  const onVisibleChange = (checked: boolean) => {
    setVisible(checked);
    void window.portalShell?.setPomodoroFloatVisible?.(checked).catch(() => {
      setVisible(!checked);
    });
  };

  if (!ready) return null;
  if (!supported) {
    return (
      <p className="text-muted-foreground text-sm">当前环境不支持番茄迷你窗（仅桌面入口）。</p>
    );
  }

  return (
    <FormToggle
      label="显示番茄迷你窗"
      hint="独立开关，不随番茄开始/结束自动显隐；可拖到屏幕边缘折叠为进度条，鼠标悬停展开操作"
      checked={visible}
      onChange={onVisibleChange}
    />
  );
}

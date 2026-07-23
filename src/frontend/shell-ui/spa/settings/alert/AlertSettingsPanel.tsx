import { useCallback, useEffect, useState } from "react";
import {
  deliverAlert,
  getAlertBackend,
  readAlertPermission,
  requestAlertPermission,
  resolveAlertDisplayPlatform,
  type AlertPermissionState,
} from "@freeanima/frontend/shell-sdk/alert";
import { Alert, AlertDescription, Button } from "@freeanima/frontend/ui-kit";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";

const PERMISSION_LABEL: Record<AlertPermissionState, string> = {
  granted: "已授权",
  denied: "已拒绝",
  default: "未请求",
  unsupported: "不支持",
};

export default function AlertSettingsPanel(_props: SettingsPanelProps) {
  const [permission, setPermission] = useState<AlertPermissionState>("default");
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [backend, setBackend] = useState(() => getAlertBackend());
  const platform = backend ? resolveAlertDisplayPlatform(backend) : "—";

  useEffect(() => {
    setBackend(getAlertBackend());
  }, []);

  useEffect(() => {
    if (!backend) return;
    void backend
      .readPermission()
      .then(setPermission)
      .catch((e: unknown) => {
        setMessage(String(e instanceof Error ? e.message : e));
        setPermission("unsupported");
      });
  }, [backend]);

  const refreshPermission = useCallback(async () => {
    const b = getAlertBackend();
    const next = b ? await b.readPermission() : await readAlertPermission();
    setPermission(next);
    return next;
  }, []);

  const handleTestAlert = async () => {
    setTesting(true);
    setMessage("");
    try {
      const perm = await requestAlertPermission();
      setPermission(perm);
      if (perm === "denied") {
        setMessage("系统通知权限已被拒绝，请在浏览器或系统设置中允许通知后重试。");
        return;
      }
      if (perm === "unsupported") {
        setMessage("当前环境不支持系统通知，将仅尝试播放提示音。");
      }
      const skipSecureContextCheck = platform === "mobile";
      if (!skipSecureContextCheck && !window.isSecureContext) {
        setMessage("当前页面非安全上下文（需 HTTPS 或 localhost），系统通知可能无法显示。");
        await deliverAlert(
          {
            title: "FreeAnima 测试提示",
            body: "仅提示音测试（非安全上下文无法弹系统通知）",
            tag: "freeanima:alert:test",
            sound: true,
            silent: true,
          },
          { suppressOsWhenFocused: false },
        );
        return;
      }
      await deliverAlert(
        {
          title: "FreeAnima 测试提示",
          body: "若看到此通知或听到提示音，说明本机 Alert 通道工作正常。",
          tag: "freeanima:alert:test",
          sound: true,
          requireInteraction: true,
        },
        { suppressOsWhenFocused: false },
      );
      setMessage(
        "系统通知已触发。若未看到弹窗，请检查系统勿扰模式、浏览器站点通知设置，或操作系统通知中心。",
      );
    } catch (e) {
      setMessage(String(e instanceof Error ? e.message : e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">平台</dt>
        <dd>
          {platform}
          {platform === "mobile" ? "（本机通知）" : null}
          {platform === "desktop" && window.satelliteShell?.showNativeAlert
            ? "（OS 原生通知）"
            : null}
          {platform === "mobile" && window.satelliteShell?.showNativeAlert
            ? "（satelliteShell 原生通道）"
            : null}
        </dd>
        <dt className="text-muted-foreground">通知权限</dt>
        <dd>{PERMISSION_LABEL[permission]}</dd>
      </dl>

      {!backend ? (
        <Alert variant="warning">
          <AlertDescription>Alert 后端未注册。请确认壳层已正常启动。</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleTestAlert()} disabled={testing || !backend}>
          {testing ? "发送中…" : "测试 Alert"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void refreshPermission()}>
          刷新权限状态
        </Button>
      </div>

      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
    </div>
  );
}

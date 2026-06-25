import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SHELL_DEBUG,
  normalizeShellDebugConfig,
  type ShellDebugConfig,
} from "@freeanima/satellite-sdk";
import type { SettingsPanelProps } from "../../../src/settings.ts";

import { detectPlatform } from "../platform.ts";
import { loadDebugSettingsFromApi, saveDebugSettingsToApi } from "../debug/debug-settings-api.ts";
import { sendSentryTestEvent } from "../bootstrap/sentry.ts";

export default function DebugSettingsPanel({ platform }: SettingsPanelProps) {
  const [values, setValues] = useState<ShellDebugConfig>({ ...DEFAULT_SHELL_DEBUG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await loadDebugSettingsFromApi();
        if (!cancelled && raw) setValues(raw);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof ShellDebugConfig>(key: K, value: ShellDebugConfig[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setStatus(null);
    },
    [],
  );

  const persist = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const normalized = normalizeShellDebugConfig(values);
      await saveDebugSettingsToApi(normalized);
      setValues(normalized);
      setStatus("已保存");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [values]);

  const onTestSentry = useCallback(async () => {
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      const ok = await persist();
      if (!ok) return;
      await sendSentryTestEvent();
      setStatus("测试事件已发送");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }, [persist]);

  if (loading) {
    return <p className="text-sm text-base-content/60">加载中…</p>;
  }

  const detected = detectPlatform();
  const hubUrl = window.satelliteShell?.hubUrl?.trim() || "（未配置）";
  const maskedHub = hubUrl.length > 24 ? `${hubUrl.slice(0, 12)}…${hubUrl.slice(-8)}` : hubUrl;

  return (
    <div className="space-y-4 pb-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Sentry 错误上报</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={values.sentryEnabled}
            onChange={(e) => setField("sentryEnabled", e.target.checked)}
          />
          <span className="text-sm">启用 Sentry</span>
        </label>
        <label className="form-control w-full max-w-xl">
          <span className="label-text text-sm">Sentry DSN</span>
          <input
            type="password"
            className="input input-bordered input-sm w-full font-mono"
            placeholder="https://…@o0.ingest.sentry.io/…"
            value={values.sentryDsn}
            onChange={(e) => setField("sentryDsn", e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => void persist()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={testing || saving}
            onClick={() => void onTestSentry()}
          >
            {testing ? "发送中…" : "发送测试事件"}
          </button>
        </div>
      </section>

      {platform === "mobile" ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">App 内控制台</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={values.vConsoleEnabled}
              onChange={(e) => setField("vConsoleEnabled", e.target.checked)}
            />
            <span className="text-sm">启用 vConsole（保存后生效）</span>
          </label>
        </section>
      ) : null}

      <section className="space-y-2 text-sm text-base-content/70">
        <h2 className="text-sm font-semibold text-base-content">开发者工具</h2>
        {platform === "desktop" ? (
          <ul className="list-disc list-inside space-y-1">
            <li>开发包自动打开 DevTools；打包后按 F12 切换</li>
            <li>
              环境变量 <code className="font-mono text-xs">DESKTOP_SHELL_DEVTOOLS=1</code>{" "}
              可在打包后默认打开
            </li>
            <li>
              主进程日志：
              <code className="font-mono text-xs">~/.anima/desktop-shell/shell.log</code>
            </li>
            <li>
              配置文件：<code className="font-mono text-xs">~/.anima-desktop/settings.json</code>
            </li>
          </ul>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            <li>Debug APK + USB：Chrome 打开 chrome://inspect 检查 WebView</li>
            <li>或使用上方 vConsole 在手机上直接看 Console</li>
          </ul>
        )}
      </section>

      <section className="text-xs text-base-content/60 space-y-1">
        <p>平台：{detected}</p>
        <p>Hub：{maskedHub}</p>
      </section>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {status ? <div className="alert alert-success text-sm">{status}</div> : null}
    </div>
  );
}

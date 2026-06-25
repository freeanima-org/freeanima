import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { initAdminLocale } from "@freeanima/admin-frontend/i18n";
import type {
  SettingsComponentLoader,
  SettingsPlatform,
  SettingsSectionDeps,
  SettingsStore,
} from "@freeanima/satellite-sdk/settings";

type Props = {
  load: SettingsComponentLoader;
  platform: SettingsPlatform;
  store: SettingsStore;
  deps?: SettingsSectionDeps;
};

export function LazyComponentPanel({ load, platform, store, deps }: Props) {
  const [retryKey, setRetryKey] = useState(0);
  const LazyPanel = useMemo(() => lazy(load), [load, retryKey]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initAdminLocale();
  }, []);

  useEffect(() => {
    setError(null);
    load().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [load, retryKey]);

  if (error) {
    return (
      <div className="space-y-2">
        <div className="alert alert-error text-sm">{error}</div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => setRetryKey((k) => k + 1)}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<p className="text-sm text-base-content/60">加载组件…</p>}>
      <LazyPanel key={retryKey} platform={platform} store={store} deps={deps} />
    </Suspense>
  );
}

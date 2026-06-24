import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { SettingsComponentLoader, SettingsPlatform } from "../../../src/settings.ts";

type Props = {
  load: SettingsComponentLoader;
  platform: SettingsPlatform;
};

export function LazyComponentPanel({ load, platform }: Props) {
  const [retryKey, setRetryKey] = useState(0);
  const LazyPanel = useMemo(() => lazy(load), [load, retryKey]);
  const [error, setError] = useState<string | null>(null);

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
      <LazyPanel key={retryKey} platform={platform} />
    </Suspense>
  );
}

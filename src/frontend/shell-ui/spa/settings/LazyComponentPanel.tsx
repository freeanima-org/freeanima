import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Alert, Button } from "@freeanima/frontend/ui-kit";
import { initConsoleLocale } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import type {
  SettingsComponentLoader,
  SettingsPlatform,
  SettingsSectionDeps,
  SettingsStore,
} from "@freeanima/frontend/shell-sdk/settings";

type Props = {
  load: SettingsComponentLoader;
  platform: SettingsPlatform;
  store?: SettingsStore;
  deps?: SettingsSectionDeps;
};

export function LazyComponentPanel({ load, platform, store, deps }: Props) {
  const [retryKey, setRetryKey] = useState(0);
  const LazyPanel = useMemo(() => lazy(load), [load, retryKey]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initConsoleLocale();
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
        <Alert variant="error" className="text-sm">
          {error}
        </Alert>
        <Button type="button" size="sm" variant="outline" onClick={() => setRetryKey((k) => k + 1)}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">加载组件…</p>}>
      <LazyPanel
        key={retryKey}
        platform={platform}
        {...(store !== undefined ? { store } : {})}
        {...(deps !== undefined ? { deps } : {})}
      />
    </Suspense>
  );
}

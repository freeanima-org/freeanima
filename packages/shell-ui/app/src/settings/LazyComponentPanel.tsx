import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { SettingsComponentLoader, SettingsPlatform } from "../../../src/settings.ts";

type Props = {
  load: SettingsComponentLoader;
  platform: SettingsPlatform;
};

export function LazyComponentPanel({ load, platform }: Props) {
  const LazyPanel = useMemo(() => lazy(load), [load]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [load]);

  if (error) {
    return <div className="alert alert-error text-sm">{error}</div>;
  }

  return (
    <Suspense fallback={<p className="text-sm text-base-content/60">加载组件…</p>}>
      <LazyPanel platform={platform} />
    </Suspense>
  );
}

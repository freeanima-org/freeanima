import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type {
  FrontendSettingsExport,
  SettingsPanelProps,
  SettingsPlatform,
  SettingsStore,
} from "@freeanima/satellite-sdk";

import { FormRenderer } from "../form/FormRenderer.tsx";
import { buildSettingsContext, createSettingsStore } from "../storage/create-settings-store.ts";

type Props = {
  section: FrontendSettingsExport;
  platform: SettingsPlatform;
};

export function SettingsSectionPanel({ section, platform }: Props) {
  const entry = section.platforms[platform];
  const store = useMemo(
    () => createSettingsStore(section.storage, buildSettingsContext(section.appId, platform)),
    [section.appId, section.storage, platform],
  );

  if (!entry) {
    return <p className="text-sm text-base-content/60">此平台暂无设置项</p>;
  }

  if (entry.kind === "form") {
    return <FormRenderer fields={entry.fields} store={store} platform={platform} />;
  }

  return <LazyComponentPanel load={entry.load} store={store} platform={platform} />;
}

function LazyComponentPanel({
  load,
  store,
  platform,
}: {
  load: () => Promise<{ default: ComponentType<SettingsPanelProps> }>;
  store: SettingsStore;
  platform: SettingsPlatform;
}) {
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
      <LazyPanel store={store} platform={platform} />
    </Suspense>
  );
}

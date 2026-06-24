import { useMemo } from "react";
import type { SettingsSection, SettingsPlatform } from "../../../src/settings.ts";
import { createShellClientStore } from "../../../src/settings-store.ts";

import { FormRenderer } from "../form/FormRenderer.tsx";
import { LazyComponentPanel } from "./LazyComponentPanel.tsx";

type Props = {
  section: SettingsSection;
  platform: SettingsPlatform;
};

export function SettingsSectionPanel({ section, platform }: Props) {
  const entry = section.platforms[platform];
  const shellStore = useMemo(() => createShellClientStore(), []);

  if (!entry) {
    return <p className="text-sm text-base-content/60">此平台暂无设置项</p>;
  }

  if (entry.kind === "form") {
    return <FormRenderer fields={entry.fields} store={shellStore} platform={platform} />;
  }

  return <LazyComponentPanel load={entry.load} platform={platform} />;
}

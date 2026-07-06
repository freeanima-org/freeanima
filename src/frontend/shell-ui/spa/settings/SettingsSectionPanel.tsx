import type { SettingsBinding, SettingsPlatform } from "@freeanima/shell-sdk/settings";

import { FormRenderer } from "../form/FormRenderer.tsx";
import { LazyComponentPanel } from "./LazyComponentPanel.tsx";

type Props = {
  binding: SettingsBinding;
  platform: SettingsPlatform;
};

export function SettingsSectionPanel({ binding, platform }: Props) {
  const { section, store, deps } = binding;
  const entry = section.platforms[platform];

  if (!entry) {
    return <p className="text-sm text-muted-foreground">此平台暂无设置项</p>;
  }

  if (entry.kind === "form") {
    if (!store) {
      return <p className="text-sm text-destructive">缺少 settings store 注入</p>;
    }
    return (
      <FormRenderer
        fields={entry.fields}
        store={store}
        platform={platform}
        sectionId={section.id}
      />
    );
  }

  return <LazyComponentPanel load={entry.load} platform={platform} store={store} deps={deps} />;
}

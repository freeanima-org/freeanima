import { createElement, type ComponentType } from "react";
import type {
  SettingsBinding,
  SettingsComponentLoader,
  SettingsPanelProps,
  SettingsSection,
} from "@freeanima/frontend/shell-sdk/settings";

import {
  ADVANCED_SECTIONS,
  ADVANCED_SECTION_TITLES,
  type AdvancedSectionId,
} from "./hub-advanced-forms.tsx";

export type HubConfigSectionKey = "compression" | "memory" | "llm" | "tts" | AdvancedSectionId;

const HUB_CONFIG_DESCRIPTION =
  "保存在 Hub 数据库，影响全体客户端；修改后可能需要重启 anima service。";

const HUB_CONFIG_SECTION_DEFS: Array<{ id: HubConfigSectionKey; title: string; order: number }> = [
  { id: "compression", title: "压缩", order: 50 },
  { id: "memory", title: "记忆", order: 51 },
  { id: "llm", title: "LLM", order: 52 },
  { id: "tts", title: "语音", order: 53 },
  ...ADVANCED_SECTIONS.map((id, index) => ({
    id,
    title: ADVANCED_SECTION_TITLES[id] ?? id,
    order: 54 + index,
  })),
];

function createHubConfigLoader(key: HubConfigSectionKey): SettingsComponentLoader {
  return () =>
    import("./HubConfigSectionPanel.tsx").then((mod) => {
      const Panel = mod.default;
      const BoundPanel: ComponentType<SettingsPanelProps> = (props) =>
        createElement(Panel, { ...props, configKey: key });
      return { default: BoundPanel };
    });
}

function createHubConfigSection(
  id: HubConfigSectionKey,
  title: string,
  order: number,
): SettingsSection {
  const load = createHubConfigLoader(id);
  return {
    id,
    order,
    category: "server",
    title,
    description: HUB_CONFIG_DESCRIPTION,
    platforms: {
      desktop: { kind: "component", load },
      mobile: { kind: "component", load },
    },
  };
}

export const hubConfigSettingsSections: SettingsSection[] = HUB_CONFIG_SECTION_DEFS.map((def) =>
  createHubConfigSection(def.id, def.title, def.order),
);

export const hubConfigSettingsBindings: SettingsBinding[] = hubConfigSettingsSections.map(
  (section) => ({ section }),
);

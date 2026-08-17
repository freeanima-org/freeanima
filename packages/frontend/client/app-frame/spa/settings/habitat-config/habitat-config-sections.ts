import { createElement, type ComponentType } from "react";
import type {
  SettingsBinding,
  SettingsComponentLoader,
  SettingsPanelProps,
  SettingsSection,
} from "@freeanima/client/portal-sdk/settings";

import {
  ADVANCED_SECTIONS,
  ADVANCED_SECTION_TITLES,
  type AdvancedSectionId,
} from "./habitat-advanced-forms.tsx";

export type HabitatConfigSectionKey = "compression" | "memory" | "llm" | "tts" | AdvancedSectionId;

const HABITAT_CONFIG_DESCRIPTION =
  "保存在栖息地数据库，影响全体客户端；保存后立即在内存中生效，无需重启。";

const HABITAT_CONFIG_SECTION_DEFS: Array<{
  id: HabitatConfigSectionKey;
  title: string;
  order: number;
}> = [
  { id: "compression", title: "压缩", order: 50 },
  { id: "memory", title: "语义记忆", order: 51 },
  { id: "llm", title: "LLM", order: 52 },
  { id: "tts", title: "语音", order: 53 },
  ...ADVANCED_SECTIONS.map((id, index) => ({
    id,
    title: ADVANCED_SECTION_TITLES[id] ?? id,
    order: 54 + index,
  })),
];

function createHabitatConfigLoader(key: HabitatConfigSectionKey): SettingsComponentLoader {
  return () =>
    import("./HabitatConfigSectionPanel.tsx").then((mod) => {
      const Panel = mod.default;
      const BoundPanel: ComponentType<SettingsPanelProps> = (props) =>
        createElement(Panel, { ...props, configKey: key });
      return { default: BoundPanel };
    });
}

function createHabitatConfigSection(
  id: HabitatConfigSectionKey,
  title: string,
  order: number,
): SettingsSection {
  const load = createHabitatConfigLoader(id);
  return {
    id,
    order,
    category: "server",
    title,
    description: HABITAT_CONFIG_DESCRIPTION,
    platforms: {
      desktop: { kind: "component", load },
      mobile: { kind: "component", load },
    },
  };
}

export const habitatConfigSettingsSections: SettingsSection[] = HABITAT_CONFIG_SECTION_DEFS.map(
  (def) => createHabitatConfigSection(def.id, def.title, def.order),
);

export const habitatConfigSettingsBindings: SettingsBinding[] = habitatConfigSettingsSections.map(
  (section) => ({ section }),
);

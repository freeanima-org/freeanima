import { createElement, type ComponentType } from "react";
import type {
  SettingsBinding,
  SettingsComponentLoader,
  SettingsPanelProps,
  SettingsSection,
} from "@freeanima/client/portal-sdk/settings";

import {
  ADVANCED_SECTION_TITLES,
  SIDEBAR_OPS_SECTIONS,
  type AdvancedSectionId,
} from "./habitat-advanced-forms.tsx";

/**
 * 栖息地配置侧栏键。
 * 「无高级」= 不设名为「高级」的收纳桶；网关 / worlds / 对象存储等仍为一等侧栏项。
 */
export type HabitatConfigSectionKey =
  | "chat"
  | "compression"
  | "memory"
  | "connections"
  | "text_generate"
  | "image_generate"
  | "audio_generate"
  | "video_generate"
  | "embedding"
  | "tts"
  /** @deprecated 兼容旧书签 */
  | "llm"
  | "dialogue"
  | "image_gen"
  | "voice"
  | "retrieval"
  | AdvancedSectionId;

const HABITAT_CONFIG_DESCRIPTION =
  "保存在栖息地数据库，影响全体客户端；保存后立即在内存中生效，无需重启。";

const OPS_SECTION_TITLES: Record<(typeof SIDEBAR_OPS_SECTIONS)[number], string> = {
  i18n: ADVANCED_SECTION_TITLES.i18n ?? "时区",
  public: ADVANCED_SECTION_TITLES.public ?? "公网访问",
  gateway: ADVANCED_SECTION_TITLES.gateway ?? "网关",
  discord: ADVANCED_SECTION_TITLES.discord ?? "Discord",
  weixin: ADVANCED_SECTION_TITLES.weixin ?? "微信",
  firecrawl: ADVANCED_SECTION_TITLES.firecrawl ?? "Firecrawl",
  browser: ADVANCED_SECTION_TITLES.browser ?? "浏览器",
  cjk: ADVANCED_SECTION_TITLES.cjk ?? "中文分词",
  fts: ADVANCED_SECTION_TITLES.fts ?? "全文检索",
  object_storage: ADVANCED_SECTION_TITLES.object_storage ?? "对象存储",
};

const HABITAT_CONFIG_SECTION_DEFS: Array<{
  id: HabitatConfigSectionKey;
  title: string;
  order: number;
}> = [
  { id: "chat", title: "聊天", order: 49 },
  { id: "compression", title: "压缩", order: 50 },
  { id: "memory", title: "语义记忆", order: 51 },
  { id: "connections", title: "连接", order: 52 },
  { id: "text_generate", title: "文本生成", order: 53 },
  { id: "image_generate", title: "图片生成", order: 54 },
  { id: "audio_generate", title: "音频生成", order: 55 },
  { id: "video_generate", title: "视频生成", order: 56 },
  { id: "embedding", title: "文本嵌入", order: 57 },
  ...SIDEBAR_OPS_SECTIONS.map((id, index) => ({
    id,
    title: OPS_SECTION_TITLES[id],
    order: 60 + index,
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

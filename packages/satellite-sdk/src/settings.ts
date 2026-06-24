import type { ComponentType } from "react";
import type { ZodType } from "zod";

import type { SettingsPlatform, SettingsStorageRef, SettingsStore } from "./settings-store.ts";

export type FormFieldType = "text" | "password" | "number" | "boolean" | "select" | "textarea";

export type FormFieldDescriptor = {
  key: string;
  type: FormFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  group?: string;
  options?: Array<{ value: string; label: string }>;
};

/** form 只需 fields；zodSchema 内聚其中 */
export type SettingsFormFields = {
  zodSchema: ZodType;
  items: FormFieldDescriptor[];
};

export type SettingsFormEntry = {
  kind: "form";
  fields: SettingsFormFields;
};

export type SettingsPanelProps = {
  store: SettingsStore<unknown>;
  platform: SettingsPlatform;
  onDirty?: () => void;
};

export type SettingsComponentLoader = () => Promise<{
  default: ComponentType<SettingsPanelProps>;
}>;

export type SettingsComponentEntry = {
  kind: "component";
  load: SettingsComponentLoader;
};

export type SettingsPlatformEntry = SettingsFormEntry | SettingsComponentEntry;

export type SettingsSection = {
  id: string;
  order: number;
  title: string;
  description?: string;
  /** 整 section 共用；form 与 component 均通过壳层注入的 store 读写 */
  storage: SettingsStorageRef;
  platforms: {
    desktop?: SettingsPlatformEntry;
    mobile?: SettingsPlatformEntry;
  };
};

export type FrontendSettingsExport = SettingsSection & {
  appId: string;
};

/** 校验 fields.items 的 key 均被 zodSchema 覆盖 */
export function defineSettingsForm(fields: SettingsFormFields): SettingsFormFields {
  const shape = getZodObjectKeys(fields.zodSchema);
  for (const item of fields.items) {
    if (!shape.has(item.key)) {
      throw new Error(`form field "${item.key}" 不在 zodSchema 中`);
    }
  }
  return fields;
}

function getZodObjectKeys(schema: ZodType): Set<string> {
  const def = schema as { shape?: Record<string, unknown> };
  if (def.shape && typeof def.shape === "object") {
    return new Set(Object.keys(def.shape));
  }
  const inner = schema as { _def?: { innerType?: ZodType } };
  if (inner._def?.innerType) {
    return getZodObjectKeys(inner._def.innerType);
  }
  return new Set();
}

/** 按 order 排序，过滤当前平台无入口的 section */
export function listSettingsSectionsForPlatform(
  exports: FrontendSettingsExport[],
  platform: SettingsPlatform,
): FrontendSettingsExport[] {
  const rows = exports.filter((exp) => exp.platforms[platform] != null);
  rows.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return rows;
}

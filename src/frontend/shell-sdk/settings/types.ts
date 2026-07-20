import type { ComponentType } from "react";
import type { ZodType } from "zod";

import type { SettingsStore } from "./settings-store.ts";

export type SettingsPlatform = "desktop" | "mobile";

export type SettingsCategory = "client" | "server";

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

export type SettingsFormFields = {
  zodSchema: ZodType;
  items: FormFieldDescriptor[];
};

export type SettingsFormEntry = {
  kind: "form";
  fields: SettingsFormFields;
};

export type SettingsPanelProps<TStore = unknown> = {
  platform: SettingsPlatform;
  store?: SettingsStore<TStore>;
  deps?: SettingsSectionDeps;
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
  /** 设置分组：本机 vs Habitat 服务（默认 client） */
  category?: SettingsCategory;
  platforms: {
    desktop?: SettingsPlatformEntry;
    mobile?: SettingsPlatformEntry;
  };
};

/** app composition root：每 binding 独占 store 实例 */
export type SettingsBinding<T = unknown> = {
  section: SettingsSection;
  store?: SettingsStore<T>;
  deps?: SettingsSectionDeps;
};

/** companion 非配置持久化操作（模型/动作经 Habitat RPC） */
export type CompanionSettingsApi = {
  uploadModel(file: File): Promise<void>;
  setActiveModel(id: string): Promise<void>;
  renameModel(id: string, name: string): Promise<void>;
  deleteModel(id: string): Promise<void>;
  refreshMotionLibrary(): Promise<void>;
};

export type SettingsSectionDeps = {
  companion?: CompanionSettingsApi;
};

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

export function listSettingsSectionsForPlatform(
  bindings: SettingsBinding[],
  platform: SettingsPlatform,
): SettingsBinding[] {
  const rows = bindings.filter((b) => b.section.platforms[platform] != null);
  rows.sort(
    (a, b) => a.section.order - b.section.order || a.section.title.localeCompare(b.section.title),
  );
  return rows;
}

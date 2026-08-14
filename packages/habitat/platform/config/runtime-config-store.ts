import {
  Config,
  isBootstrapConfigKey,
  parseRuntimeConfig,
  type RuntimeConfig,
} from "@freeanima/habitat/core/config";
import {
  getHabitatRuntimeConfigDocument,
  patchHabitatRuntimeConfigSection,
  replaceHabitatRuntimeConfigSection,
} from "@freeanima/habitat/core/db/pg";
import { applyRuntimeConfigSection } from "./runtime-config-apply.ts";

export type PatchableRuntimeConfig = Config & {
  patchSection(section: string, patch: Record<string, unknown>): Promise<RuntimeConfig>;
  replaceSection(section: string, value: Record<string, unknown>): Promise<RuntimeConfig>;
  reload(): Promise<RuntimeConfig>;
};

export function isPatchableRuntimeConfig(config: Config): config is PatchableRuntimeConfig {
  return (
    typeof (config as PatchableRuntimeConfig).patchSection === "function" &&
    typeof (config as PatchableRuntimeConfig).replaceSection === "function" &&
    typeof (config as PatchableRuntimeConfig).reload === "function"
  );
}

/** PG habitat_runtime_config 运行时配置存储 */
export class RuntimeConfigStore extends Config implements PatchableRuntimeConfig {
  private constructor(snapshot: RuntimeConfig) {
    super(snapshot);
  }

  static async loadSnapshot(): Promise<RuntimeConfig> {
    const document = await getHabitatRuntimeConfigDocument();
    return parseRuntimeConfig(document);
  }

  static async open(): Promise<RuntimeConfigStore> {
    const snapshot = await RuntimeConfigStore.loadSnapshot();
    return new RuntimeConfigStore(snapshot);
  }

  async reload(): Promise<RuntimeConfig> {
    const next = await RuntimeConfigStore.loadSnapshot();
    this.update(next);
    await applyRuntimeConfigSection(this, "*");
    return next;
  }

  async patchSection(section: string, patch: Record<string, unknown>): Promise<RuntimeConfig> {
    if (isBootstrapConfigKey(section)) {
      throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非栖息地运行时配置`);
    }
    const document = await patchHabitatRuntimeConfigSection(section, patch);
    const next = parseRuntimeConfig(document);
    this.update(next);
    await applyRuntimeConfigSection(this, section);
    return next;
  }

  async replaceSection(section: string, value: Record<string, unknown>): Promise<RuntimeConfig> {
    if (isBootstrapConfigKey(section)) {
      throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非栖息地运行时配置`);
    }
    const document = await replaceHabitatRuntimeConfigSection(section, value);
    const next = parseRuntimeConfig(document);
    this.update(next);
    await applyRuntimeConfigSection(this, section);
    return next;
  }
}

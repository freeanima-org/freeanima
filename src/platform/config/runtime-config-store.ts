import {
  Config,
  isBootstrapConfigKey,
  parseRuntimeConfig,
  type RuntimeConfig,
} from "@freeanima/core/config";
import {
  getHubRuntimeConfigDocument,
  patchHubRuntimeConfigSection,
  replaceHubRuntimeConfigSection,
} from "@freeanima/core/db/pg";

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

/** PG hub_runtime_config 运行时配置存储 */
export class RuntimeConfigStore extends Config implements PatchableRuntimeConfig {
  private constructor(snapshot: RuntimeConfig) {
    super(snapshot as import("@freeanima/core/config").AnimaConfig);
  }

  static async loadSnapshot(): Promise<RuntimeConfig> {
    const document = await getHubRuntimeConfigDocument();
    return parseRuntimeConfig(document);
  }

  static async open(): Promise<RuntimeConfigStore> {
    const snapshot = await RuntimeConfigStore.loadSnapshot();
    return new RuntimeConfigStore(snapshot);
  }

  async reload(): Promise<RuntimeConfig> {
    const next = await RuntimeConfigStore.loadSnapshot();
    this.update(next as import("@freeanima/core/config").AnimaConfig);
    return next;
  }

  async patchSection(section: string, patch: Record<string, unknown>): Promise<RuntimeConfig> {
    if (isBootstrapConfigKey(section)) {
      throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非 Hub 服务配置`);
    }
    const document = await patchHubRuntimeConfigSection(section, patch);
    const next = parseRuntimeConfig(document);
    this.update(next as import("@freeanima/core/config").AnimaConfig);
    return next;
  }

  async replaceSection(section: string, value: Record<string, unknown>): Promise<RuntimeConfig> {
    if (isBootstrapConfigKey(section)) {
      throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非 Hub 服务配置`);
    }
    const document = await replaceHubRuntimeConfigSection(section, value);
    const next = parseRuntimeConfig(document);
    this.update(next as import("@freeanima/core/config").AnimaConfig);
    return next;
  }
}

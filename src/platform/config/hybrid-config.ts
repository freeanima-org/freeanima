import {
  Config,
  type AnimaConfig,
  animaConfigSchema,
  bootstrapConfigSchema,
  hasRuntimeSectionsInYaml,
  isBootstrapConfigKey,
  isEmptyRuntimeDocument,
  mergeBootstrapWithDocument,
  pickBootstrapRecord,
  pickRuntimeDocument,
} from "@freeanima/core/config";
import {
  getHubRuntimeConfigDocument,
  patchHubRuntimeConfigSection,
  replaceHubRuntimeConfigDocument,
} from "@freeanima/core/db/pg";
import { loadConfigYamlRecord } from "./yaml-io.ts";

export type PatchableConfig = Config & {
  patchSection(
    section: keyof AnimaConfig | string,
    patch: Record<string, unknown>,
  ): Promise<AnimaConfig>;
  reload(): Promise<AnimaConfig>;
};

export function isPatchableConfig(config: Config): config is PatchableConfig {
  return (
    typeof (config as PatchableConfig).patchSection === "function" &&
    typeof (config as PatchableConfig).reload === "function"
  );
}

function parseMergedConfig(merged: Record<string, unknown>): AnimaConfig {
  const parsed = animaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid merged config: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function loadRuntimeDocumentWithImport(): Promise<Record<string, unknown>> {
  const yamlRecord = loadConfigYamlRecord();
  let document = await getHubRuntimeConfigDocument();

  if (isEmptyRuntimeDocument(document) && hasRuntimeSectionsInYaml(yamlRecord)) {
    document = pickRuntimeDocument(yamlRecord);
    await replaceHubRuntimeConfigDocument(document);
    console.log("[config] 已从 config.yaml 导入运行时配置到数据库");
  }

  return document;
}

/** PG + bootstrap.yaml 混合配置 */
export class HybridConfig extends Config implements PatchableConfig {
  private constructor(snapshot: AnimaConfig) {
    super(snapshot);
  }

  static async loadSnapshot(): Promise<AnimaConfig> {
    const yamlRecord = loadConfigYamlRecord();
    const bootstrap = pickBootstrapRecord(yamlRecord);
    const bootstrapParsed = bootstrapConfigSchema.safeParse(bootstrap);
    if (!bootstrapParsed.success) {
      throw new Error(`Invalid bootstrap config.yaml: ${bootstrapParsed.error.message}`);
    }

    const document = await loadRuntimeDocumentWithImport();
    return parseMergedConfig(mergeBootstrapWithDocument(bootstrap, document));
  }

  static async open(): Promise<HybridConfig> {
    const snapshot = await HybridConfig.loadSnapshot();
    return new HybridConfig(snapshot);
  }

  async reload(): Promise<AnimaConfig> {
    const next = await HybridConfig.loadSnapshot();
    this.update(next);
    return next;
  }

  async patchSection(
    section: keyof AnimaConfig | string,
    patch: Record<string, unknown>,
  ): Promise<AnimaConfig> {
    if (isBootstrapConfigKey(section)) {
      throw new Error(`bootstrap 段 ${section} 不能通过 API 修改，请编辑 config.yaml`);
    }

    const document = await patchHubRuntimeConfigSection(section, patch);
    const bootstrap = pickBootstrapRecord(loadConfigYamlRecord());
    const next = parseMergedConfig(mergeBootstrapWithDocument(bootstrap, document));
    this.update(next);
    return next;
  }

  /** 从当前 config.yaml 导入运行时段（幂等合并） */
  static async importRuntimeFromYamlFile(): Promise<AnimaConfig> {
    const yamlRecord = loadConfigYamlRecord();
    const runtime = pickRuntimeDocument(yamlRecord);
    if (isEmptyRuntimeDocument(runtime)) {
      throw new Error("config.yaml 中没有可导入的运行时段");
    }

    const existing = await getHubRuntimeConfigDocument();
    const merged = { ...existing, ...runtime };
    await replaceHubRuntimeConfigDocument(merged);
    return HybridConfig.loadSnapshot();
  }
}

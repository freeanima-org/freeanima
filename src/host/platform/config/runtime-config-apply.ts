import type { Config, RuntimeConfig } from "@freeanima/host/core/config";
import { resolveAndBindWorldContext } from "@freeanima/host/core/config/world-context";
import { applyHostI18nConfig } from "@freeanima/host/core/i18n";
import { initLlmRuntime } from "@freeanima/host/core/llm";
import { getAcpManager } from "@freeanima/host/capabilities/acp";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/host/capabilities/connectors/gateway";
import { bindObjectStore, createObjectStore } from "@freeanima/features/object-storage/domain";
import { logComponent } from "@freeanima/host/platform/logging";
import type { MessagingPort } from "@freeanima/host/platform/ports/messaging-port";
import type { McpManagerPort } from "@freeanima/host/platform/ports/mcp-manager";
import type { ServiceEnginePort } from "@freeanima/host/platform/ports/service-engine";
import { resolveLlmProviderApiKeys } from "./llm-resolve.ts";
import { bindEmbeddingRuntime } from "../service/embedding-bind.ts";
import { bindTokenizerRuntime } from "../service/tokenizer-bind.ts";
import {
  isRuntimeContextReady,
  getRuntimeDeps,
  getAppRuntime,
} from "../service/runtime-context.ts";

const log = logComponent("config-apply");

/** 改 snapshot 不够、须 re-bind 的运行时段 */
export const TRANSFERRED_RUNTIME_SECTIONS = [
  "llm",
  "i18n",
  "embedding",
  "mcp_servers",
  "acp_agents",
  "discord",
  "weixin",
  "gateway",
  "worlds",
  "object_storage",
] as const;

export type TransferredRuntimeSection = (typeof TRANSFERRED_RUNTIME_SECTIONS)[number];

export type RuntimeConfigApplyDeps = {
  getMcp?: () => McpManagerPort | null;
  getEngine?: () => ServiceEnginePort | null;
  getMessaging?: () => MessagingPort | null;
  getPlatformsRef?: () => { list: PlatformAdapter[] } | null;
};

let applyDeps: RuntimeConfigApplyDeps = {};

/** Composition root：在 engine / HTTP ready 后绑定热 apply 依赖 */
export function bindRuntimeConfigApplyDeps(next: RuntimeConfigApplyDeps): void {
  applyDeps = { ...applyDeps, ...next };
}

/** 单测隔离 */
export function resetRuntimeConfigApplyDepsForTest(): void {
  applyDeps = {};
}

function isTransferred(section: string): section is TransferredRuntimeSection {
  return (TRANSFERRED_RUNTIME_SECTIONS as readonly string[]).includes(section);
}

async function applyLlm(config: Config): Promise<void> {
  const resolved = await resolveLlmProviderApiKeys(config.data);
  config.update(resolved);
  const runtime = initLlmRuntime(config.data);
  const engine =
    applyDeps.getEngine?.() ?? (isRuntimeContextReady() ? getRuntimeDeps().engine : null);
  if (engine) {
    (engine as { llm: typeof runtime }).llm = runtime;
  }
  await bindTokenizerRuntime(config);
}

function applyI18n(cfg: RuntimeConfig): void {
  applyHostI18nConfig({
    locale: cfg.i18n?.locale,
    timezone: cfg.i18n?.timezone,
  });
}

async function applyMcp(): Promise<void> {
  const mcp =
    applyDeps.getMcp?.() ?? (isRuntimeContextReady() ? (getRuntimeDeps().mcp ?? null) : null);
  if (!mcp) {
    log.debug("mcp apply skipped: manager not ready");
    return;
  }
  await mcp.stopAll();
  await mcp.startAllEnabled();
}

async function applyAcp(): Promise<void> {
  await getAcpManager().reloadEnabledFromConfig();
}

async function applyGateway(config: Config): Promise<void> {
  const platformsRef = applyDeps.getPlatformsRef?.() ?? null;
  const messaging =
    applyDeps.getMessaging?.() ??
    (isRuntimeContextReady() ? (getAppRuntime() as unknown as MessagingPort) : null);
  if (!platformsRef || !messaging) {
    log.debug("gateway apply skipped: platforms/messaging not ready");
    return;
  }
  await stopPlatforms(platformsRef.list);
  platformsRef.list = [];
  const adapters = await discoverPlatforms(messaging, config);
  platformsRef.list = adapters;
  await startPlatforms(adapters);
}

/**
 * 将内存中的 runtime 配置段应用到已转存的子系统。
 * live 段（compression / memory / fts 等）仅依赖 snapshot，无需 hook。
 * `@` / `*` 表示对全部 transferred 段执行 apply（reload 用）。
 */
export async function applyRuntimeConfigSection(config: Config, section: string): Promise<void> {
  const sections: string[] =
    section === "*" || section === "@"
      ? [...TRANSFERRED_RUNTIME_SECTIONS]
      : isTransferred(section)
        ? [section]
        : [];

  for (const key of sections) {
    try {
      switch (key) {
        case "llm":
          await applyLlm(config);
          break;
        case "i18n":
          applyI18n(config.data);
          break;
        case "embedding":
          bindEmbeddingRuntime(config);
          await bindTokenizerRuntime(config);
          break;
        case "mcp_servers":
          await applyMcp();
          break;
        case "acp_agents":
          await applyAcp();
          break;
        case "discord":
        case "weixin":
        case "gateway":
          await applyGateway(config);
          break;
        case "worlds":
          await resolveAndBindWorldContext(config.data);
          break;
        case "object_storage":
          bindObjectStore(createObjectStore(config.data.object_storage ?? {}));
          break;
        default:
          break;
      }
      log.info(`runtime config applied: ${key}`);
    } catch (err) {
      log.error(`runtime config apply failed: ${key}`, { err });
      throw new Error(
        `配置已写入数据库，但热应用「${key}」失败: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }
}

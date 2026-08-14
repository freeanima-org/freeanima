import type { Config } from "@freeanima/habitat/core/config";
import { registerRuntimeConfigSchemas } from "@freeanima/habitat/core/config/schemas/runtime-config.ts";
import { resolveAndBindWorldContext } from "@freeanima/habitat/core/config/world-context-pg";
import { applyHostI18nConfig } from "@freeanima/habitat/core/i18n";
import { initLlmRuntime } from "@freeanima/habitat/core/llm";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/habitat/capabilities/connectors/gateway";
import { bindObjectStore, createObjectStore } from "@freeanima/features/object-storage/domain";
import { registerSection } from "@freeanima/habitat/kernel/config-mechanism";
import { logComponent } from "@freeanima/habitat/platform/logging";
import type { MessagingPort } from "@freeanima/habitat/platform/ports/messaging-port";
import type { McpManagerPort } from "@freeanima/habitat/platform/ports/mcp-manager";
import type { ServiceEnginePort } from "@freeanima/habitat/platform/ports/service-engine";
import { resolveLlmProviderApiKeys } from "./llm-resolve.ts";
import { bindEmbeddingRuntime } from "../service/embedding-bind.ts";
import { bindSearchRuntime } from "@freeanima/habitat/core/db/pg/search";
import { bindTokenizerRuntime } from "../service/tokenizer-bind.ts";
import {
  isRuntimeContextReady,
  getRuntimeDeps,
  getAppRuntime,
} from "../service/runtime-context.ts";

const log = logComponent("config-apply");

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

/** 单测隔离（仅 deps；不清理 section 注册表） */
export function resetRuntimeConfigApplyDepsForTest(): void {
  applyDeps = {};
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

function applyI18n(config: Config): void {
  applyHostI18nConfig({
    timezone: config.data.i18n?.timezone,
  });
}

async function applyMcp(config: Config): Promise<void> {
  const mcp =
    applyDeps.getMcp?.() ?? (isRuntimeContextReady() ? (getRuntimeDeps().mcp ?? null) : null);
  if (!mcp) {
    log.debug("mcp apply skipped: manager not ready");
    return;
  }
  await mcp.stopAll();
  await mcp.startAllEnabled();
  // MCP re-register 后确保 config overrides 仍生效
  applyToolsetVisibility(config);
}

function applyToolsetVisibility(config: Config): void {
  const engine =
    applyDeps.getEngine?.() ?? (isRuntimeContextReady() ? getRuntimeDeps().engine : null);
  if (!engine?.catalog?.toolSets) {
    log.debug("toolset_visibility apply skipped: engine not ready");
    return;
  }
  const raw = config.data.toolset_visibility ?? {};
  const overrides: Record<string, "hidden" | "searchable" | "catalog"> = {};
  for (const [name, visibility] of Object.entries(raw)) {
    if (visibility === "hidden" || visibility === "searchable" || visibility === "catalog") {
      overrides[name] = visibility;
    }
  }
  engine.catalog.toolSets.setVisibilityOverrides(overrides);
}

async function applyGateway(config: Config): Promise<void> {
  const platformsRef = applyDeps.getPlatformsRef?.() ?? null;
  const messaging =
    applyDeps.getMessaging?.() ?? (isRuntimeContextReady() ? getAppRuntime() : null);
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

async function applyEmbedding(config: Config): Promise<void> {
  bindEmbeddingRuntime(config);
  await bindTokenizerRuntime(config);
}

function applyFts(config: Config): void {
  bindSearchRuntime(config);
}

async function applyWorlds(config: Config): Promise<void> {
  await resolveAndBindWorldContext(config.data);
}

function applyObjectStorage(config: Config): void {
  bindObjectStore(createObjectStore(config.data.object_storage ?? {}));
}

/**
 * 将产品段 apply 挂入 kernel 注册表（幂等合并）。
 * schema 由 core `registerRuntimeConfigSchemas` 提供。
 */
export function registerRuntimeConfigApplies(): void {
  registerRuntimeConfigSchemas();

  registerSection({ key: "llm", apply: applyLlm, transferred: true, order: 10 });
  registerSection({ key: "i18n", apply: applyI18n, transferred: true, order: 20 });
  registerSection({ key: "embedding", apply: applyEmbedding, transferred: true, order: 30 });
  registerSection({ key: "mcp_servers", apply: applyMcp, transferred: true, order: 40 });
  registerSection({
    key: "toolset_visibility",
    apply: applyToolsetVisibility,
    transferred: true,
    order: 50,
  });
  registerSection({ key: "discord", apply: applyGateway, transferred: true, order: 60 });
  registerSection({ key: "weixin", apply: applyGateway, transferred: true, order: 70 });
  registerSection({ key: "gateway", apply: applyGateway, transferred: true, order: 80 });
  registerSection({ key: "worlds", apply: applyWorlds, transferred: true, order: 90 });
  registerSection({
    key: "object_storage",
    apply: applyObjectStorage,
    transferred: true,
    order: 100,
  });
  // 有 apply、非 transferred（历史 switch 曾含 case；单 key 可调度）
  registerSection({ key: "fts", apply: applyFts, transferred: false });
}

registerRuntimeConfigApplies();

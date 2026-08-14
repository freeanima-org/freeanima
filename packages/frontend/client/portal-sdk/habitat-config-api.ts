import { getBundledHabitatClient } from "@freeanima/shared/habitat-client/bundled-browser.ts";

import { resolveHabitatApiFetch } from "./habitat-api-fetch.ts";

function habitatRpc() {
  return getBundledHabitatClient({
    profile: "outpost",
    fetch: resolveHabitatApiFetch() as typeof fetch,
  });
}

export async function fetchHabitatConfig(): Promise<Record<string, unknown>> {
  return (await habitatRpc().call("config.get", {})) as Record<string, unknown>;
}

export async function fetchHabitatConfigSection(section: string): Promise<unknown> {
  return habitatRpc().call("config.getSection", { section });
}

export async function patchHabitatConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await habitatRpc().call("config.patchSection", { section, patch })) as Record<
    string,
    unknown
  >;
}

export async function replaceHabitatConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await habitatRpc().call("config.replaceSection", { section, value })) as Record<
    string,
    unknown
  >;
}

export async function restartHabitatService(): Promise<void> {
  await habitatRpc().call("status.restart", {});
}

export type HabitatServiceUpdateProxy = "none" | "ghproxy-net" | "gh-proxy-com" | "ghfast-top";

export type HabitatServiceUpdateCheckResult = {
  ok: true;
  install_kind: "source" | "standalone";
  upgradable: boolean;
  reason?: string;
  hint?: string;
  localVersion?: string;
  remoteVersion?: string;
  assetUrl?: string;
  channel?: string;
};

export type HabitatServiceUpdateApplyResult =
  | {
      ok: true;
      install_kind: "standalone";
      remoteVersion: string;
      code: "service_restarting";
    }
  | {
      ok: false;
      install_kind: "source" | "standalone";
      reason: string;
      hint?: string;
      message?: string;
      remoteVersion?: string;
    };

export async function checkHabitatServiceUpdate(opts?: {
  proxy?: HabitatServiceUpdateProxy;
}): Promise<HabitatServiceUpdateCheckResult> {
  return (await habitatRpc().call(
    "status.updateCheck",
    opts?.proxy != null ? { proxy: opts.proxy } : {},
  )) as HabitatServiceUpdateCheckResult;
}

export async function applyHabitatServiceUpdate(opts?: {
  proxy?: HabitatServiceUpdateProxy;
}): Promise<HabitatServiceUpdateApplyResult> {
  return (await habitatRpc().call(
    "status.updateApply",
    opts?.proxy != null ? { proxy: opts.proxy } : {},
  )) as HabitatServiceUpdateApplyResult;
}

export type HabitatConfigTestService =
  | "firecrawl"
  | "camofox"
  | "embedding"
  | "llm_provider"
  | "discord"
  | "weixin"
  | "object_storage";

export type HabitatConfigTestConnectionResult = {
  ok: boolean;
  message: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
};

export async function testHabitatConfigConnection(input: {
  service: HabitatConfigTestService;
  config?: Record<string, unknown>;
  provider_id?: string;
}): Promise<HabitatConfigTestConnectionResult> {
  return (await habitatRpc().call(
    "config.testConnection",
    input,
  )) as HabitatConfigTestConnectionResult;
}

export type HabitatProviderModelEntry = {
  model: string;
  label?: string;
  contextWindow: number;
  maxOutputTokens: number;
  cost?: { input?: number; output?: number };
};

export type HabitatListProviderModelsResult = {
  models: HabitatProviderModelEntry[];
  source: "provider" | "models_dev";
};

export async function listHabitatProviderModels(input: {
  provider_id: string;
  query?: string;
  limit?: number;
}): Promise<HabitatListProviderModelsResult> {
  return (await habitatRpc().call(
    "config.listProviderModels",
    input,
  )) as HabitatListProviderModelsResult;
}

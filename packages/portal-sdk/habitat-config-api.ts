import { getTypedHabitatClient, type HabitatMethodOutputs } from "./habitat-typed-client.ts";
import { resolveHabitatApiFetch } from "./habitat-api-fetch.ts";

function habitatRpc() {
  return getTypedHabitatClient({
    profile: "outpost",
    fetch: resolveHabitatApiFetch(),
  });
}

export async function fetchHabitatConfig(): Promise<Record<string, unknown>> {
  return habitatRpc().call("config.get", {});
}

export async function fetchHabitatConfigSection(section: string): Promise<unknown> {
  return habitatRpc().call("config.getSection", { section });
}

export async function patchHabitatConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return habitatRpc().call("config.patchSection", { section, patch });
}

export async function replaceHabitatConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return habitatRpc().call("config.replaceSection", { section, value });
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
  const raw = await habitatRpc().call(
    "status.updateCheck",
    opts?.proxy != null ? { proxy: opts.proxy } : {},
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- status.updateCheck 契约为 unknownOutputSchema，收窄到产品结果形
  return raw as HabitatServiceUpdateCheckResult;
}

export async function applyHabitatServiceUpdate(opts?: {
  proxy?: HabitatServiceUpdateProxy;
}): Promise<HabitatServiceUpdateApplyResult> {
  const raw = await habitatRpc().call(
    "status.updateApply",
    opts?.proxy != null ? { proxy: opts.proxy } : {},
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- status.updateApply 契约为 unknownOutputSchema，收窄到产品结果形
  return raw as HabitatServiceUpdateApplyResult;
}

export type HabitatConfigTestService =
  | "firecrawl"
  | "camofox"
  | "embedding"
  | "llm_provider"
  | "discord"
  | "weixin"
  | "object_storage";

export type HabitatConfigTestConnectionResult = HabitatMethodOutputs["config.testConnection"];

export async function testHabitatConfigConnection(input: {
  service: HabitatConfigTestService;
  config?: Record<string, unknown>;
  provider_id?: string;
}): Promise<HabitatConfigTestConnectionResult> {
  return habitatRpc().call("config.testConnection", input);
}

export type HabitatListProviderModelsResult = HabitatMethodOutputs["config.listProviderModels"];
export type HabitatProviderModelEntry = HabitatListProviderModelsResult["models"][number];

export async function listHabitatProviderModels(input: {
  provider_id: string;
  query?: string;
  limit?: number;
  purpose?: "chat" | "image_generate" | "embedding" | "voice_generate" | "video_generate";
}): Promise<HabitatListProviderModelsResult> {
  return habitatRpc().call("config.listProviderModels", input);
}

export type HabitatListProviderVoicesResult = HabitatMethodOutputs["config.listProviderVoices"];
export type HabitatProviderVoiceEntry = HabitatListProviderVoicesResult["voices"][number];

/** 按连接 voice_protocol 返回静态音色目录（与合成模型列表分维） */
export async function listHabitatProviderVoices(input: {
  provider_id: string;
  model?: string;
  query?: string;
  limit?: number;
}): Promise<HabitatListProviderVoicesResult> {
  return habitatRpc().call("config.listProviderVoices", input);
}

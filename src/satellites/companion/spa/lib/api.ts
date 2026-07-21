import type {
  ClientCompanionConfig,
  LocomotionSlot,
  MotionLibraryEntry,
  MotionSlotId,
} from "@freeanima/satellites/companion/shared/constants.ts";
import type { CompanionBehavior } from "@freeanima/satellites/companion/shared/companion-schema.ts";
import { fetchHabitatRestRaw, parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";
import { getCompanionHabitatClient, type CompanionHubConfigResponse } from "./habitat-client.ts";
import { resolveHubBaseUrl, resolveSidecarOrigin } from "./sidecar.ts";

export function resetSidecarOriginCache(): void {
  /* sidecar origin 缓存已移除；保留 API 兼容 */
}

export type CompanionConfig = ClientCompanionConfig;

function wrapHubConfig(
  cfg: Omit<ClientCompanionConfig, "app_id" | "instance_id" | "remote_tools_connected"> & {
    app_id?: ClientCompanionConfig["app_id"];
    instance_id?: string;
    remote_tools_connected?: boolean;
  },
): CompanionConfig {
  return {
    ...cfg,
    app_id: "companion",
    instance_id: cfg.instance_id ?? "",
    remote_tools_connected: cfg.remote_tools_connected ?? false,
  };
}

async function hubBase(): Promise<string> {
  return (await resolveHubBaseUrl()).replace(/\/$/, "");
}

export async function fetchCompanionConfig(): Promise<CompanionConfig> {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.get",
    {},
  );
  const cfg = data.config;
  return wrapHubConfig(cfg);
}

/** Overlay 运行时：从本地 sidecar 读取 instance_id / sap / 缓存配置 */
export async function fetchSidecarRuntimeConfig(): Promise<CompanionConfig> {
  const base = await resolveSidecarOrigin();
  const res = await fetch(`${base}/api/config`);
  if (!res.ok) {
    throw new Error(`sidecar config HTTP ${res.status}`);
  }
  return wrapHubConfig((await res.json()) as ClientCompanionConfig);
}

export async function fetchSidecarRuntimeFields(): Promise<{
  instance_id: string;
  remote_tools_connected: boolean;
}> {
  try {
    const cfg = await fetchSidecarRuntimeConfig();
    return { instance_id: cfg.instance_id, remote_tools_connected: cfg.remote_tools_connected };
  } catch {
    return { instance_id: "", remote_tools_connected: false };
  }
}

/** Habitat 设置页：profile 走 RPC，运行时字段走 sidecar */
export async function loadHabitatCompanionSettingsConfig(): Promise<CompanionConfig> {
  const profile = await fetchCompanionConfig();
  const runtime = await fetchSidecarRuntimeFields();
  return { ...profile, ...runtime };
}

export async function saveSettings(patch: {
  hub_url?: string;
  behavior?: Partial<CompanionBehavior>;
  motion_slots?: ClientCompanionConfig["motion_slots"];
}) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.update",
    {
      ...(patch.behavior !== undefined ? { behavior: patch.behavior } : {}),
      ...(patch.motion_slots !== undefined ? { motion_slots: patch.motion_slots } : {}),
    },
  );
  return wrapHubConfig(data.config);
}

export async function uploadModel(file: File) {
  const base = await hubBase();
  const form = new FormData();
  form.append("file", file);
  const res = await fetchHabitatRestRaw(base, "companion.model.upload", {}, { body: form });
  await parseHabitatRestResponse(res);
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.get",
    {},
  );
  return { config: wrapHubConfig(data.config) };
}

export async function setActiveModel(id: string) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.model.setActive",
    { id },
  );
  return { config: wrapHubConfig(data.config) };
}

export async function renameModel(id: string, name: string) {
  await getCompanionHabitatClient().call("companion.model.rename", { id, name });
}

export async function deleteModel(id: string) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.model.delete",
    { id },
  );
  return { config: wrapHubConfig(data.config) };
}

export async function fetchMotionLibrary() {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.get",
    {},
  );
  return {
    library: data.config.motion_library,
    slots: data.config.motion_slots,
  };
}

export async function uploadMotionFile(file: File) {
  const base = await hubBase();
  const form = new FormData();
  form.append("file", file);
  const res = await fetchHabitatRestRaw(base, "companion.motion.import", {}, { body: form });
  const body = (await parseHabitatRestResponse(res)) as {
    library?: MotionLibraryEntry[];
    entries?: MotionLibraryEntry[];
    skipped_fbx?: string[];
  };
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.get",
    {},
  );
  const skipped = body.skipped_fbx;
  return {
    ok: true as const,
    dir: "",
    files: body.entries?.map((e) => e.file) ?? [],
    entries: body.entries ?? [],
    library: data.config.motion_library,
    ...(skipped && skipped.length > 0 ? { skipped_fbx: skipped } : {}),
  };
}

export async function setMotionSlot(slot: MotionSlotId, motionIds: string[]) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.motion.setSlot",
    {
      slot,
      motion_ids: motionIds,
    },
  );
  return { config: wrapHubConfig(data.config) };
}

export async function renameMotion(id: string, name: string) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.motion.rename",
    { id, name },
  );
  return { entry: data.config.motion_library.find((e) => e.id === id) };
}

export async function deleteMotion(id: string) {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.motion.delete",
    { id },
  );
  return { library: data.config.motion_library, config: wrapHubConfig(data.config) };
}

export async function fetchMotionStatus() {
  const data = await getCompanionHabitatClient().call<CompanionHubConfigResponse>(
    "companion.config.get",
    {},
  );
  return {
    ready: data.config.motion_library.length > 0,
    user_dir: "",
    required: [] as string[],
    booth_url: "",
    auto_download_configured: false,
    fbx_import_available: data.config.fbx_import_available,
  };
}

export async function uploadLocomotionMotion(_slot: LocomotionSlot, file: File) {
  return uploadMotionFile(file);
}

export async function fetchLocomotionStatus() {
  const data = await fetchMotionLibrary();
  return {
    library: data.library,
    slots: data.slots,
    user_dir: "",
  };
}

export async function downloadMotionsFromMirror() {
  throw new Error("请通过 Settings 动作库导入 VRMA/FBX");
}

export function runtimeWsUrl(httpOrigin: string): string {
  return `${httpOrigin.replace(/^http/, "ws")}/api/runtime/ws`;
}

export async function advanceBubble() {
  const shell = window.satelliteShell;
  if (shell?.isElectron && shell.advanceCompanionBubble) {
    return shell.advanceCompanionBubble();
  }
  const base = await resolveSidecarOrigin();
  const res = await fetch(`${base}/api/bubbles/advance`, { method: "POST" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { current: { id: string; text: string } | null };
}

export { isElectron } from "./electron.ts";

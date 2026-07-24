import type {
  ClientCompanionConfig,
  LocomotionSlot,
  MotionLibraryEntry,
  MotionSlotId,
} from "@freeanima/features/companion/shared/constants.ts";
import type { CompanionBehavior } from "@freeanima/features/companion/shared/companion-schema.ts";
import type { CompanionClientConfigPayload } from "@freeanima/shared/rpc-contract/frames/companion";
import { parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";
import { getCompanionHabitatClient } from "./habitat-client.ts";
import { resolveCompanionDevOrigin } from "./companion-local.ts";

export type CompanionConfig = ClientCompanionConfig;

function wrapHabitatConfig(
  cfg: CompanionClientConfigPayload & {
    app_id?: ClientCompanionConfig["app_id"];
    instance_id?: string;
    remote_tools_connected?: boolean;
  },
): CompanionConfig {
  return {
    ...cfg,
    habitat_url: cfg.habitat_url ?? "",
    app_id: "companion",
    instance_id: cfg.instance_id ?? "",
    remote_tools_connected: cfg.remote_tools_connected ?? false,
  };
}

export async function fetchCompanionConfig(): Promise<CompanionConfig> {
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
  return wrapHabitatConfig(data.config);
}

/** Overlay 运行时：Portal 壳走 Habitat RPC；无壳时才回退本地 companion/dev HTTP。 */
export async function fetchOverlayCompanionConfig(): Promise<CompanionConfig> {
  const shell = window.portalShell;
  if (shell?.isNativeShell || shell?.isTauri) {
    return loadHabitatCompanionSettingsConfig();
  }
  try {
    return await fetchLocalCompanionRuntimeConfig();
  } catch {
    return loadHabitatCompanionSettingsConfig();
  }
}

/** 无壳 / companion/dev：本地 HTTP `/api/config` */
export async function fetchLocalCompanionRuntimeConfig(): Promise<CompanionConfig> {
  const base = await resolveCompanionDevOrigin();
  const res = await fetch(`${base}/api/config`);
  if (!res.ok) {
    throw new Error(`companion local config HTTP ${res.status}`);
  }
  return wrapHabitatConfig((await res.json()) as ClientCompanionConfig);
}

export async function fetchCompanionRuntimeFields(): Promise<{
  instance_id: string;
  remote_tools_connected: boolean;
}> {
  const shell = window.portalShell;
  if (shell?.getCompanionRemoteToolsStatus) {
    try {
      return await shell.getCompanionRemoteToolsStatus();
    } catch {
      /* fall through */
    }
  }
  try {
    const cfg = await fetchLocalCompanionRuntimeConfig();
    return { instance_id: cfg.instance_id, remote_tools_connected: cfg.remote_tools_connected };
  } catch {
    return { instance_id: "", remote_tools_connected: false };
  }
}

/** Habitat 设置页：profile 走 RPC，运行时字段走壳/本地 status */
export async function loadHabitatCompanionSettingsConfig(): Promise<CompanionConfig> {
  const profile = await fetchCompanionConfig();
  const runtime = await fetchCompanionRuntimeFields();
  return { ...profile, ...runtime };
}

export async function saveSettings(patch: {
  behavior?: Partial<CompanionBehavior>;
  motion_slots?: ClientCompanionConfig["motion_slots"];
}) {
  const data = await getCompanionHabitatClient().call("companion.config.update", {
    ...(patch.behavior !== undefined ? { behavior: patch.behavior } : {}),
    ...(patch.motion_slots !== undefined ? { motion_slots: patch.motion_slots } : {}),
  });
  return wrapHabitatConfig(data.config);
}

export async function uploadModel(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await getCompanionHabitatClient().callRaw(
    "companion.model.upload",
    {},
    { body: form },
  );
  await parseHabitatRestResponse(res);
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
  return { config: wrapHabitatConfig(data.config) };
}

export async function setActiveModel(id: string) {
  const data = await getCompanionHabitatClient().call("companion.model.setActive", { id });
  return { config: wrapHabitatConfig(data.config) };
}

export async function renameModel(id: string, name: string) {
  await getCompanionHabitatClient().call("companion.model.rename", { id, name });
}

export async function deleteModel(id: string) {
  const data = await getCompanionHabitatClient().call("companion.model.delete", { id });
  return { config: wrapHabitatConfig(data.config) };
}

export async function fetchMotionLibrary() {
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
  return {
    library: data.config.motion_library,
    slots: data.config.motion_slots,
  };
}

export async function uploadMotionFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await getCompanionHabitatClient().callRaw(
    "companion.motion.import",
    {},
    { body: form },
  );
  const body = (await parseHabitatRestResponse(res)) as {
    library?: MotionLibraryEntry[];
    entries?: MotionLibraryEntry[];
    skipped_fbx?: string[];
  };
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
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
  const data = await getCompanionHabitatClient().call("companion.motion.setSlot", {
    slot,
    motion_ids: motionIds,
  });
  return { config: wrapHabitatConfig(data.config) };
}

export async function renameMotion(id: string, name: string) {
  const data = await getCompanionHabitatClient().call("companion.motion.rename", { id, name });
  return { entry: data.config.motion_library.find((e) => e.id === id) };
}

export async function deleteMotion(id: string) {
  const data = await getCompanionHabitatClient().call("companion.motion.delete", { id });
  return { library: data.config.motion_library, config: wrapHabitatConfig(data.config) };
}

export async function fetchMotionStatus() {
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
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

/** companion/dev 本地 runtime WS（Portal overlay 不走此路径） */
export function runtimeWsUrl(httpOrigin: string): string {
  return `${httpOrigin.replace(/^http/, "ws")}/api/runtime/ws`;
}

export async function advanceBubble() {
  const { advanceBubbleLocal } = await import("./runtime-local.ts");
  const current = advanceBubbleLocal();
  return { current };
}

export { isPortalShell } from "./portal-shell.ts";

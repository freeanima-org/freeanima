import type {
  ClientCompanionConfig,
  LocomotionSlot,
  MotionLibraryEntry,
  MotionSlotId,
} from "@freeanima/shared/companion-app/constants.ts";
import type { CompanionBehavior } from "@freeanima/shared/companion-app/companion-schema.ts";
import type { CompanionClientConfigPayload } from "@freeanima/shared/rpc-contract/frames/companion";
import { parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";
import { getCompanionHabitatClient } from "./habitat-client.ts";

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

/** Overlay / 无壳：一律 Habitat RPC（不再打本地 `/api/config`）。 */
export async function fetchOverlayCompanionConfig(): Promise<CompanionConfig> {
  return loadHabitatCompanionSettingsConfig();
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
  return { instance_id: "", remote_tools_connected: false };
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

export async function setActiveModel(objectFileId: number) {
  const data = await getCompanionHabitatClient().call("companion.model.setActive", {
    object_file_id: objectFileId,
  });
  return { config: wrapHabitatConfig(data.config) };
}

export async function renameModel(objectFileId: number, name: string) {
  await getCompanionHabitatClient().call("companion.model.rename", {
    object_file_id: objectFileId,
    name,
  });
}

export async function deleteModel(objectFileId: number) {
  const data = await getCompanionHabitatClient().call("companion.model.delete", {
    object_file_id: objectFileId,
  });
  return { config: wrapHabitatConfig(data.config) };
}

export async function reorderModels(objectFileIds: number[]) {
  const data = await getCompanionHabitatClient().call("companion.model.reorder", {
    object_file_ids: objectFileIds,
  });
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
  };
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
  return {
    ok: true as const,
    dir: "",
    files: body.entries?.map((e) => String(e.object_file_id)) ?? [],
    entries: body.entries ?? [],
    library: data.config.motion_library,
  };
}

export async function setMotionSlot(slot: MotionSlotId, objectFileIds: number[]) {
  const data = await getCompanionHabitatClient().call("companion.motion.setSlot", {
    slot,
    object_file_ids: objectFileIds,
  });
  return { config: wrapHabitatConfig(data.config) };
}

export async function renameMotion(objectFileId: number, name: string) {
  const data = await getCompanionHabitatClient().call("companion.motion.rename", {
    object_file_id: objectFileId,
    name,
  });
  return {
    entry: data.config.motion_library.find((e) => e.object_file_id === objectFileId),
  };
}

export async function deleteMotion(objectFileId: number) {
  const data = await getCompanionHabitatClient().call("companion.motion.delete", {
    object_file_id: objectFileId,
  });
  return { library: data.config.motion_library, config: wrapHabitatConfig(data.config) };
}

export async function reorderMotions(objectFileIds: number[]) {
  const data = await getCompanionHabitatClient().call("companion.motion.reorder", {
    object_file_ids: objectFileIds,
  });
  return { config: wrapHabitatConfig(data.config) };
}

export async function fetchMotionStatus() {
  const data = await getCompanionHabitatClient().call("companion.config.get", {});
  return {
    ready: data.config.motion_library.length > 0,
    user_dir: "",
    required: [] as string[],
    booth_url: "",
    auto_download_configured: false,
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
  throw new Error("请通过 Settings 动作库导入 .vrma");
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

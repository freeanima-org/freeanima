import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { jsonResponse } from "./http/cors.ts";
import { motionFileNameForId, newMotionId } from "../shared/asset-id.ts";
import { companionMotionsDir } from "./paths.ts";
import { resolveFbx2gltfBinary } from "./fbx-converter-kit.ts";
import { convertFbxToVrmaFiles } from "./fbx2vrma-core.ts";
import { loadConfig } from "./config.ts";
import {
  LOCOMOTION_SLOT_LABELS,
  LOCOMOTION_SLOTS,
  type LocomotionSlot,
} from "../shared/constants.ts";
import { resolveMotionFile } from "./motions.ts";
import { registerMotionEntry, setSlotMotions } from "./motion-library.ts";
import type { MotionSlotId } from "../shared/companion-schema.ts";
import { removePath, writeBytes } from "./process-utils.ts";

export { LOCOMOTION_SLOTS };

export type LocomotionSlotInfo = {
  slot: LocomotionSlot;
  label: string;
  file: string | null;
  available: boolean;
};

function slotOutputName(slot: LocomotionSlot): string {
  const cfg = loadConfig();
  const slotIds = cfg.motion_slots[locomotionMotionSlot(slot)] ?? [];
  for (const ref of slotIds) {
    const byId = cfg.motion_library.find((e) => e.id === ref);
    if (byId) return byId.file;
  }
  return `locomotion_${slot}.vrma`;
}

function locomotionMotionSlot(slot: LocomotionSlot): MotionSlotId {
  return slot;
}

async function convertFbxToVrma(inputPath: string, outputPath: string): Promise<void> {
  const fbx2gltf = resolveFbx2gltfBinary();
  await convertFbxToVrmaFiles(inputPath, outputPath, fbx2gltf, "30");
}

export function locomotionFileForSlot(slot: LocomotionSlot): string | null {
  const cfg = loadConfig();
  const slotIds = cfg.motion_slots[locomotionMotionSlot(slot)] ?? [];
  for (const ref of slotIds) {
    const byId = cfg.motion_library.find((e) => e.id === ref);
    if (byId) return byId.file;
    if (ref.endsWith(".vrma")) return ref;
  }
  const legacy = slotOutputName(slot);
  return resolveMotionFile(`/motions/${legacy}`) ? legacy : null;
}

export function locomotionSlotStatus(): LocomotionSlotInfo[] {
  return LOCOMOTION_SLOTS.map((slot) => {
    const file = locomotionFileForSlot(slot);
    const available = file != null && resolveMotionFile(`/motions/${file}`) != null;
    return {
      slot,
      label: LOCOMOTION_SLOT_LABELS[slot],
      file: available ? file : null,
      available,
    };
  });
}

export function locomotionConfigForClient(): Record<LocomotionSlot, string | null> {
  const out = {} as Record<LocomotionSlot, string | null>;
  for (const info of locomotionSlotStatus()) {
    out[info.slot] = info.available ? info.file : null;
  }
  return out;
}

export async function importLocomotionFile(
  slot: LocomotionSlot,
  uploadName: string,
  bytes: Uint8Array,
): Promise<{ slot: LocomotionSlot; file: string }> {
  if (!LOCOMOTION_SLOTS.includes(slot)) {
    throw new Error(`未知槽位: ${slot}`);
  }

  const lower = uploadName.toLowerCase();
  if (!lower.endsWith(".fbx") && !lower.endsWith(".vrma")) {
    throw new Error("仅支持 .fbx 或 .vrma");
  }

  mkdirSync(companionMotionsDir(), { recursive: true });
  const id = newMotionId();
  const destName = motionFileNameForId(id);
  const destPath = join(companionMotionsDir(), destName);
  const tempDir = join(companionMotionsDir(), ".locomotion-import");
  mkdirSync(tempDir, { recursive: true });

  const tempInput = join(tempDir, basename(uploadName));
  await writeBytes(tempInput, bytes);

  try {
    if (lower.endsWith(".fbx")) {
      await convertFbxToVrma(tempInput, destPath);
    } else {
      await writeBytes(destPath, bytes);
    }
  } finally {
    await removePath(tempDir);
  }

  const entry = registerMotionEntry({
    id,
    name: LOCOMOTION_SLOT_LABELS[slot],
    file: destName,
  });
  setSlotMotions(locomotionMotionSlot(slot), [entry.id]);

  return { slot, file: destName };
}

export async function handleLocomotionImport(
  req: Request,
  slot: LocomotionSlot,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "无效的 multipart 请求" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "缺少 file 字段" }, 400);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importLocomotionFile(slot, file.name, bytes);
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
}
